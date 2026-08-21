# WatchParty — Salas de chat en vivo por partido

Challenge técnico de onboarding. Aplicación web donde el usuario elige entre dos
partidos y entra a una sala de chat en tiempo real cuyos mensajes llegan
únicamente a quienes están en esa misma sala.

## Stack

- **Cliente:** React + Vite + TypeScript + Tailwind CSS v4
- **Servidor:** Node.js + Express + TypeScript (ejecutado con `tsx`)
- **Tiempo real:** WebSockets nativos con la librería `ws`
- **Tests:** Vitest, sobre `server/src/`

### Por qué `ws` nativo y no `socket.io`

`socket.io` resuelve las salas por dentro con `socket.join()` e `io.to().emit()`.
Justamente eso —el ruteo de salas y el broadcast filtrado— es el núcleo del
ejercicio, así que se escribió a mano para que la lógica sea explícita y
verificable. Las funciones que `socket.io` habría aportado de regalo
(reconexión automática, heartbeats) no están entre los requerimientos, y su
ausencia queda documentada más abajo como limitación consciente.

## Cómo ejecutarlo

Requiere **Node 22** o superior.

```bash
# Terminal 1 — servidor (puerto 8080)
cd server
npm install
npm run dev

# Terminal 2 — cliente (puerto 5173)
cd client
npm install
npm run dev
```

Abrir `http://localhost:5173`. Para ver el aislamiento, abrir dos pestañas y
entrar a salas distintas.

```bash
cd server && npm test        # 39 tests: contrato, registro de salas e integracion
cd server && npm run typecheck
cd client && npm run typecheck
```

## Cómo está estructurada la separación de salas en el backend

El servidor mantiene un `Map<RoomId, Room>` creado **al arrancar**
(`resetRooms()` en `server/src/rooms.ts`), con una entrada por partido. Cada
sala guarda dos cosas: un `Set` con las conexiones presentes y un array con
los últimos 50 mensajes (`HISTORY_LIMIT`).

```ts
interface Room {
  clients: Set<Client>;
  history: Message[];
}
let rooms = new Map<RoomId, Room>();
```

La sala viaja en el **handshake** (`ws://localhost:8080?room=boca-river&user=Martina`),
no en un mensaje posterior. Si la sala no existe o el usuario viene vacío, la
conexión se cierra en el acto (`ws.close(4004, ...)`) antes de entrar a
ningún `Set`: así toda conexión nace perteneciendo a una sala válida, sin un
estado intermedio donde una conexión abierta no pertenezca a ninguna sala.

El broadcast recorre únicamente el `Set` de su propia sala:

```ts
export function broadcast(roomId: RoomId, event: ServerEvent): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const data = JSON.stringify(event); // se serializa una sola vez, no una por cliente
  for (const client of room.clients) {
    if (client.readyState === OPEN) client.send(data);
  }
}
```

**El aislamiento no es un filtro que se aplica al enviar: es consecuencia de
dónde se guardan las conexiones.** Las conexiones de la otra sala están en
otro `Set`, en otra entrada del `Map`, y este código no tiene forma de
alcanzarlas. No hay ningún `if (client.room === roomId)` que se pueda olvidar
o escribir mal.

Además, el servidor nunca cree en la identidad que declara el cliente: en
`server/src/index.ts`, el cliente envía solo el contenido del evento
(`CHAT` o `REACTION`), y el autor, el id y el timestamp los arma el servidor
(`{ id: randomUUID(), roomId: room, user, timestamp: Date.now() }`) a partir
del nombre registrado en el handshake, no de nada que venga en el mensaje.

Está cubierto por los 9 tests de `server/src/rooms.test.ts`, entre ellos uno
que confirma explícitamente que un mensaje de `boca-river` no llega a los
clientes de `argentina-brasil`.

### Verificación manual del aislamiento

Además de los tests automáticos, se verificó a mano con dos ventanas:
mandando un mensaje en Boca vs. River, la sala de Argentina vs. Brasil quedó
vacía. Entrando tarde a una sala se recibe el historial completo, y saliendo
y volviendo a entrar cada mensaje aparece una sola vez, sin duplicados. El
log del servidor termina en `(0 conectados)` en ambas salas al cerrar las
pestañas: no quedan conexiones colgadas.

## Cómo se limpian las conexiones al desmontar el componente

Toda la lógica del WebSocket vive en `client/src/hooks/useRoomSocket.ts`. El
`useEffect` que abre la conexión devuelve una función de limpieza que React
ejecuta al desmontar la sala:

```ts
return () => {
  // Los tres handlers se desenganchan, no solo onmessage.
  ws.onmessage = null;
  ws.onclose = null;
  ws.onerror = null;

  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close(1000, "Salio de la sala");
  } else {
    ws.onopen = null;
    ws.close(1000, "Salio de la sala");
  }

  socketRef.current = null;
};
```

Al tocar "Salir", `App` pone la sesión en `null` (ver `client/src/App.tsx`),
`Room` se desmonta y corre esa limpieza. **El `close()` del cliente es el
mismo evento que el `ws.on("close")` del servidor**, que saca la conexión del
`Set` de la sala en `server/src/index.ts`: las dos limpiezas son las dos
puntas del mismo cierre.

### Por qué se desenganchan los tres handlers, no solo `onmessage`

La primera versión solo ponía `ws.onmessage = null` en la limpieza. Bajo
`StrictMode`, React monta, desmonta y vuelve a montar cada componente en
desarrollo, y eso puede dejar dos sockets en vuelo: el viejo (A), que
todavía está cerrando, y el nuevo (B), que ya abrió. Si el `onclose` de A
sigue enganchado, cuando A termina de cerrarse pisa el estado que B ya había
puesto en `"open"` con `"closed"` — dejando la sala mostrando "desconectado"
con el input deshabilitado mientras en realidad sigue recibiendo mensajes
por el socket B. Desenganchar `onmessage`, `onclose` y `onerror` juntos evita
que un socket que ya no importa pueda tocar el estado del componente actual.

Sin esta limpieza completa, entrar y salir cinco veces dejaría sockets vivos
de sobra: el servidor le seguiría mandando mensajes a conexiones que nadie
escucha, y — en el escenario de arriba — la UI podría quedar mostrando un
estado que no corresponde a la conexión real.

Dos detalles más del hook que hacen que esto funcione de verdad:

- **La instancia va en un `useRef`**, no en `useState`: el socket no se
  dibuja, así que guardarlo en estado provocaría re-renders inútiles; y una
  variable local se recrearía en cada render, perdiendo la conexión.
- **Un segundo ref (`hasOpenedRef`) distingue "nunca llegó a abrir" de "abrió
  y después se cayó".** `onerror` siempre viene seguido de `onclose`: sin
  este ref, cualquier error de conexión terminaría reportado como `"closed"`
  en vez de `"error"`, perdiendo la distinción entre "no se pudo conectar" y
  "se conectó y la conexión se cortó".
- **El chequeo de `CONNECTING`** existe porque `StrictMode` monta, desmonta y
  vuelve a montar cada componente en desarrollo, justamente para delatar
  limpiezas mal hechas. Cerrar un socket que todavía negocia produce el
  warning "WebSocket is closed before the connection is established"; esperar
  al `open` lo evita sin desactivar `StrictMode`. Verificado: la consola del
  navegador queda limpia, sin ese warning.

El servidor loguea el conteo por sala en cada entrada y salida, así que la
limpieza se puede verificar mirando la terminal:

```
[boca-river] + Martina (2 conectados)
[boca-river] - Martina (1 conectados)
```

## Integridad de tipos

`shared/types.ts` es el único lugar donde está definido qué puede viajar por
el socket, y lo importan cliente y servidor por igual: una sola fuente de
verdad. No se usa `any` en ninguna parte del repositorio (cliente, servidor
ni contrato compartido).

Los eventos son uniones discriminadas por `type` (`ClientEvent`, `ServerEvent`)
y los mensajes distinguen texto de reacción por el campo `kind`.

Como los tipos desaparecen al compilar y `JSON.parse` devuelve datos sin
tipar, el contrato valida **los dos sentidos** de la conversación con dos
funciones separadas, cada una en el borde donde realmente hace falta:

- **`parseClientEvent(raw: unknown)`**, en el borde de entrada del servidor:
  reconstruye el evento que mandó el cliente campo por campo. Lo que no está
  en el contrato nunca entra al sistema — un `CHAT` sin `text` string o una
  `REACTION` con un `reactionId` que no está en `REACTIONS` se descarta y el
  servidor responde `{ type: "ERROR", reason: "Mensaje invalido" }`.
- **`parseServerEvent(raw: unknown)`**, en el borde de entrada del cliente:
  valida la forma del sobre que llega del servidor (`HISTORY`, `MESSAGE`,
  `ERROR`) antes de tocarlo en `useRoomSocket.ts`. No revalida cada `Message`
  dentro de `messages`/`message` campo por campo, porque esos objetos ya
  pasaron por el borde validado del servidor (`parseClientEvent` más el
  estado de `rooms.ts`); alcanza con confirmar que el sobre no llegó
  corrompido.

Tener los dos validadores, no solo uno, es lo que permite que ninguno de los
dos lados le crea ciegamente al otro: el servidor no confía en lo que dice
el cliente, y el cliente no asume que todo lo que llega por el socket tiene
la forma esperada. Están cubiertos por 13 + 8 tests en
`server/src/types.test.ts`.

## Extra: reacciones rápidas

Además del input de texto que pide la consigna, la sala tiene una fila de
mensajes predefinidos (⚽ ¡GOL!, 👏 Vamos, 😱 No lo puedo creer, 🤬 Robo, 🙌 Qué
jugada). La razón es de producto: en una watch party el usuario está mirando
el partido, y escribir obliga a despegar la vista de la pantalla.

El cliente envía solo el identificador de la reacción (`ReactionId`), nunca
su texto, y el servidor lo valida contra la lista compartida `REACTIONS` de
`shared/types.ts`. Así no se pueden inventar reacciones editando el JSON
desde la consola del navegador. Verificado también en pantallas angostas
(390px de ancho): la barra de reacciones scrollea internamente y la página
no desborda horizontalmente.

## Cómo se recuerda el nombre del usuario

El nombre no vive dentro de `Home`, sino en `App`. El motivo es concreto: al
entrar a una sala, `App` desmonta `Home`, y un componente desmontado no
conserva su estado. Si el nombre viviera ahí, volver al Home significaría
montar un `Home` nuevo, en blanco, y tener que escribirlo otra vez.

Al subirlo a `App`, `Home` pasa a ser un componente **controlado**: recibe el
nombre y avisa cuando cambia, pero no lo guarda. Editarlo sale gratis, porque
el input del Home aparece con el valor actual.

Para que además sobreviva a recargar la página, se persiste en `localStorage`
(`client/src/storage.ts`). Dos detalles de ese módulo:

- **Se lee una sola vez**, con el inicializador perezoso de `useState`, no en
  cada render.
- **Todo acceso va en `try/catch`.** En modo incógnito, o con el navegador
  configurado para bloquear datos de sitios, *acceder* a `localStorage` lanza
  una excepción: sin el catch la aplicación no arrancaría. Si falla, se
  degrada al comportamiento anterior, con el campo vacío.

## Decisiones y limitaciones conscientes

- **Historial en memoria, últimos 50 mensajes por sala.** Se pierde al
  reiniciar el servidor. No hay base de datos porque no está en el alcance.
- **Sin heartbeat (ping/pong).** Si un cliente desaparece sin cierre limpio
  (por ejemplo, un corte de red), puede tardar en salir del registro. La
  solución estándar sería que el servidor mande un ping periódico y
  desconecte a quien no responda.
- **Sin reconexión automática.** Si se cae la conexión se muestra el estado
  y el usuario puede volver al Home.
- **Sin autenticación.** El nombre es libre y no se valida contra nada: es un
  identificador de conveniencia, no una identidad.
- **Navegación por estado, sin router.** `App.tsx` decide entre `Home` y
  `Room` con un `useState<RoomId | null>`. Recargar dentro de una sala
  devuelve al Home (con el nombre ya puesto), no a la sala: se recuerda quién
  sos, no dónde estabas.
- **"Mensaje propio" se determina por nombre.** Si dos personas eligen el
  mismo nombre, ambas verán los mensajes de la otra como propios. Resolverlo
  bien requeriría un id de cliente asignado por el servidor.
