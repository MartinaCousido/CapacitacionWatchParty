# Diseño: Mini-WatchParty Chat Rooms

> **Estado: documento previo a la implementación.**
> El código cambió después por hallazgos de code review, así que algunos
> pasajes de este documento ya no describen exactamente lo que se entregó.
> La fuente de verdad de lo implementado es el `README.md` de la raíz.

**Fecha:** 2026-08-20
**Estado:** Aprobado, listo para plan de implementación
**Origen:** Challenge técnico de onboarding (ticket `8-capacitacion-deploy.md`)

---

## 1. Objetivo

Construir una aplicación web donde un usuario elige entre dos partidos y entra a
una sala de chat en vivo. Los mensajes de una sala llegan únicamente a quienes
están en esa misma sala.

Este proyecto tiene un objetivo doble y conviene tenerlo presente al decidir:

1. **Cumplir la consigna** del challenge, que se evalúa con criterios explícitos.
2. **Aprender el stack** (Vite, Tailwind, TypeScript, Express, WebSockets). Ante
   dos opciones válidas, se prefiere la que expone el mecanismo sobre la que lo
   esconde detrás de una librería.

### Criterios de evaluación declarados en la consigna

1. Manejo del ciclo de vida del WebSocket en React (desconexión limpia al
   desmontar, sin fugas de memoria; uso correcto de `useState`/`useEffect`/`useRef`).
2. Lógica de ruteo de salas en el backend (a qué sala pertenece cada conexión y
   broadcast filtrado por sala).
3. TypeScript: contratos de datos estrictos para los mensajes del socket, sin `any`.
4. Buenas prácticas de Git: commits atómicos, ramas por feature, integración por
   Pull Request.

Además: README con instrucciones de ejecución y explicación escrita de (a) cómo
se estructuró la separación de salas en el backend y (b) cómo se limpian las
conexiones en el cliente al desmontar.

---

## 2. Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Librería de tiempo real | **`ws` nativo** | La lógica de salas queda escrita a mano y visible, que es justo el criterio 2. `socket.io` la resolvería con `socket.join`. Además `ws` primero y `socket.io` después es el orden que se entiende; al revés no. |
| Lenguaje del backend | **TypeScript** | La consigna permite JS "para agilizar", pero eso anularía medio ejercicio de tipos. |
| Historial de mensajes | **Sí, en memoria, últimos 50 por sala** | Cuesta poco, agrega un evento a la unión discriminada, y hace que el aislamiento sea visible de inmediato al probar con dos pestañas. |
| Nombre de usuario | **Se pide en el Home** | Input controlado + pasaje de datos entre pantallas. Botones deshabilitados mientras esté vacío. |
| Navegación | **Estado en `App`**, sin router | El foco es WebSockets y tipos. Además, como el nombre vive en memoria, con URLs reales habría que manejar el caso de recargar dentro de una sala. |
| Contrato de tipos | **Carpeta `shared/` importada por ambos lados** | Una sola fuente de verdad. Sin la configuración extra de npm workspaces. |
| Envío de mensajes | **Input de texto + botones de reacción** | La consigna exige el input textualmente. Las reacciones se suman como extra de producto (en una watch party el usuario no quiere despegar la vista del partido). |
| Tests | **Sí, acotados a `rooms.ts`** con Vitest | Lógica pura, sin navegador ni red. Testea exactamente el requisito más importante. No se testean componentes React. |

### Alcance excluido a propósito

- **Sin heartbeat (ping/pong).** Si un cliente desaparece sin cierre limpio, puede
  tardar en salir del registro. No está en los requerimientos. Se documenta.
- **Sin persistencia.** El historial se pierde al reiniciar el servidor.
- **Sin límite de mensajes por segundo.**
- **Sin autenticación.** El nombre es libre y no se valida contra nada.
- **Sin reconexión automática.** Si se cae la conexión, se muestra el estado y el
  usuario vuelve al Home.

---

## 3. Estructura del repositorio

```
CapacitacionWatchParty/
├── shared/
│   └── types.ts              contrato del socket + listas de partidos y reacciones
├── server/
│   ├── src/
│   │   ├── index.ts          Express + HTTP + WebSocketServer + ciclo de conexión
│   │   ├── rooms.ts          registro de salas (conexiones + historial)
│   │   └── rooms.test.ts     tests de aislamiento y limpieza (Vitest)
│   ├── package.json
│   └── tsconfig.json
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── screens/Home.tsx
│   │   ├── screens/Room.tsx
│   │   ├── hooks/useRoomSocket.ts
│   │   └── components/{MessageList,ReactionBar,ChatInput}.tsx
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
├── docs/
├── .gitignore
└── README.md
```

`client` y `server` son dos proyectos npm independientes, cada uno con su
`npm install` y su `npm run dev`. `shared/` no es un proyecto: es un archivo de
tipos que ambos importan por ruta relativa.

**El servidor no se compila:** corre con `tsx watch src/index.ts`, que ejecuta
TypeScript directamente. Con `tsc` habría que ajustar `rootDir` para aceptar un
import que sale de `server/` hacia `shared/`. El chequeo de tipos se mantiene con
`tsc --noEmit`.

Puertos: cliente `5173` (Vite), servidor `8080`.

---

## 4. Flujo de datos punta a punta

1. El usuario entra a `localhost:5173`. `App` no tiene sesión → muestra `Home`.
2. Escribe su nombre y elige un partido. `App` guarda `{ roomId, user }`.
3. `Home` se desmonta, `Room` se monta.
4. `useRoomSocket` abre `ws://localhost:8080?room=boca-river&user=Martina`.
5. El servidor valida la sala, mete la conexión en el `Set` de esa sala y le
   envía el historial guardado.
6. El usuario envía un mensaje: el cliente manda `{ type: "CHAT", text }`.
7. El servidor le agrega autor, timestamp e id, lo guarda en el historial y lo
   retransmite a todas las conexiones de esa sala (incluido el emisor).
8. Los clientes de la sala reciben `{ type: "MESSAGE", message }` y lo agregan.
9. El usuario sale: `Room` se desmonta → la limpieza del `useEffect` cierra el
   socket → el servidor recibe `close` y saca la conexión del `Set`.

### Dos decisiones dentro del flujo

**La sala viaja en el handshake (query param), no en un mensaje `JOIN_ROOM`.**
La consigna admite ambas. El query param elimina un estado intermedio: con
`JOIN_ROOM` existe un instante en que hay una conexión abierta que todavía no
pertenece a ninguna sala, y hay que decidir qué hacer si llega un mensaje en esa
ventana. Con query param, toda conexión nace perteneciendo a una sala o es
rechazada en el acto.

**El servidor nunca confía en la identidad que declara el cliente.** El cliente
manda solo el contenido; `user`, `timestamp` e `id` los asigna el servidor a
partir del nombre registrado en el handshake. Si el cliente enviara su propio
`user` en cada mensaje, cualquiera podría firmar mensajes con otro nombre
editando el JSON desde la consola del navegador.

---

## 5. El contrato de tipos (`shared/types.ts`)

Único lugar del proyecto donde está definido qué puede viajar por el socket.

### Listas como fuente de los tipos

```ts
export const MATCHES = [
  { id: "boca-river",       label: "Boca vs. River" },
  { id: "argentina-brasil", label: "Argentina vs. Brasil" },
] as const;

export type RoomId = typeof MATCHES[number]["id"];
// "boca-river" | "argentina-brasil"

export const REACTIONS = [
  { id: "gol",            emoji: "⚽", label: "¡GOL!" },
  { id: "vamos",          emoji: "👏", label: "Vamos" },
  { id: "nolopuedocreer", emoji: "😱", label: "No lo puedo creer" },
  { id: "robo",           emoji: "🤬", label: "Robo" },
  { id: "jugada",         emoji: "🙌", label: "Qué jugada" },
] as const;

export type ReactionId = typeof REACTIONS[number]["id"];
```

`as const` hace que TypeScript trate los valores como literales, lo que permite
**derivar el tipo desde el dato**. La lista se escribe una sola vez: el Home la
recorre para dibujar botones, la sala la recorre para las reacciones, y el
servidor la usa para validar. Al agregar un partido, el tipo se actualiza solo y
cualquier lugar que no lo contemple deja de compilar.

### El mensaje

```ts
interface BaseMessage {
  id: string;
  roomId: RoomId;
  user: string;
  timestamp: number;   // epoch ms
}

export type Message =
  | (BaseMessage & { kind: "text";     text: string })
  | (BaseMessage & { kind: "reaction"; reactionId: ReactionId });
```

`kind` es el discriminante: al preguntar `if (msg.kind === "text")`, dentro del
bloque el compilador sabe que existe `msg.text` y rechaza `msg.reactionId`.

`timestamp` es `number` y no `Date` porque **JSON no tiene fechas**. Un `Date`
enviado por el socket llega como string del otro lado, y `msg.timestamp.getHours()`
falla en ejecución mientras TypeScript afirma que está bien. La hora se formatea
al mostrarla con `toLocaleTimeString`.

### Los dos sentidos

```ts
export type ClientEvent =
  | { type: "CHAT";     text: string }
  | { type: "REACTION"; reactionId: ReactionId };

export type ServerEvent =
  | { type: "HISTORY"; messages: Message[] }
  | { type: "MESSAGE"; message: Message }
  | { type: "ERROR";   reason: string };
```

Uniones separadas a propósito: lo que puede decir el cliente y lo que puede decir
el servidor no son lo mismo, y tenerlas separadas impide enviar un `HISTORY`
desde el navegador.

El cliente procesa `ServerEvent` con un `switch` sobre `type`, cerrado con un
chequeo de exhaustividad:

```ts
default: {
  const _exhaustive: never = event;   // no compila si falta manejar un caso
  return _exhaustive;
}
```

### Validación en el borde

Los tipos existen solo en compilación. `JSON.parse` devuelve `any`: un agujero
por donde entra cualquier cosa. Un cliente desactualizado o malicioso puede
enviar `{ type: "REACTION", reactionId: "inventado" }` y TypeScript no interviene
porque ya no está corriendo.

Por eso el borde se valida a mano, una sola vez:

```ts
export function parseClientEvent(raw: unknown): ClientEvent | null;
export function parseServerEvent(raw: unknown): ServerEvent | null;
export function isRoomId(value: string): value is RoomId;
```

**Corrección posterior a la implementación:** el diseño original validaba solo
el borde de entrada del servidor. La review señaló que el cliente hacía lo
mismo que se le reprocha a cualquiera —asignar el resultado de `JSON.parse` a
un tipo sin comprobarlo— así que `shared/types.ts` terminó exportando también
`parseServerEvent`, y el archivo del contrato valida los dos sentidos. El
cliente valida la forma del sobre (`type` y sus campos), no cada `Message`
anidado: el productor es nuestro propio servidor, que ya construye esos
mensajes él mismo.

El hook además guarda un segundo ref, `hasOpenedRef`, para distinguir "nunca
llegó a abrir" (estado `error`) de "abrió y se cayó" (estado `closed`): como
`onerror` siempre viene seguido de `onclose`, sin ese ref el estado `error`
quedaba pisado y era inalcanzable.

`unknown` y no `any` como entrada: `unknown` obliga a comprobar antes de acceder
a nada. El servidor llama `parseClientEvent` apenas recibe; si devuelve `null`,
descarta. De ahí para adentro el código puede confiar en los tipos.

---

## 6. Backend

División: `rooms.ts` guarda el estado, `index.ts` conecta y maneja el ciclo de
vida de cada conexión.

### Armado (`index.ts`)

```ts
const app = express();
app.get("/health", (_, res) => res.json({ ok: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

server.listen(8080);
```

Express y el WebSocket comparten servidor HTTP y puerto. Un WebSocket empieza
como una petición HTTP que pide convertirse (el *upgrade*); `WebSocketServer({ server })`
se engancha a esas peticiones y deja el resto a Express. No son dos servidores:
es un servidor HTTP que sabe hacer dos cosas.

Express hace poco en este proyecto (un endpoint de salud). Está porque la
consigna lo pide en el stack y porque deja el esqueleto para una API futura.

### Registro (`rooms.ts`)

```ts
type Room = {
  clients: Set<WebSocket>;
  history: Message[];
};

const rooms = new Map<RoomId, Room>(
  MATCHES.map(m => [m.id, { clients: new Set(), history: [] }])
);
```

Las salas se crean **al arrancar el servidor**, una por partido de `MATCHES`, no
cuando llega el primer usuario. Eso elimina toda una familia de preguntas: nunca
hay que verificar si una sala existe ni decidir si borrarla cuando queda vacía.

`Set` y no array: eliminar es `clients.delete(ws)` en tiempo constante, sin
buscar índices ni riesgo de duplicados.

API del módulo:

```ts
join(roomId, ws)            // agrega al Set
leave(roomId, ws)           // saca del Set; idempotente
getHistory(roomId)          // Message[]
addToHistory(roomId, msg)   // push + recorte a HISTORY_LIMIT (50)
broadcast(roomId, event)    // envía a todas las conexiones de esa sala
countClients(roomId)        // para logs y tests
```

### Broadcast aislado

```ts
export function broadcast(roomId: RoomId, event: ServerEvent) {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(event);            // serializa una sola vez
  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
```

**El aislamiento no es una regla que se verifica: es consecuencia de la
estructura.** El bucle recorre el `Set` de esa sala. Las conexiones de la otra
están en otro `Set`, en otra entrada del `Map`, y este código no tiene forma de
alcanzarlas. No hay un `if (client.room === roomId)` que se pueda olvidar o
escribir mal. Para que un mensaje se filtrara habría que haber metido la conexión
en el `Set` equivocado al conectarse.

Detalles: `JSON.stringify` fuera del bucle (serializar el mismo objeto una vez
por cliente es trabajo repetido); el chequeo de `readyState` evita escribir en un
socket que se está cerrando en ese instante.

### Ciclo de vida de una conexión

```ts
wss.on("connection", (ws, req) => {
  const url  = new URL(req.url ?? "", "http://localhost");
  const room = url.searchParams.get("room") ?? "";
  const user = (url.searchParams.get("user") ?? "").trim().slice(0, 24);

  if (!isRoomId(room) || user.length === 0) {
    ws.close(4004, "Sala o usuario inválidos");
    return;
  }

  join(room, ws);
  ws.send(JSON.stringify({ type: "HISTORY", messages: getHistory(room) }));

  ws.on("message", raw => { /* ver abajo */ });
  ws.on("close", () => leave(room, ws));
  ws.on("error", () => leave(room, ws));
});
```

`room` y `user` quedan capturados en el closure: cada conexión tiene sus valores
sin necesidad de un `Map<WebSocket, datos>` aparte.

**`close` y `error` son lo que evita la fuga de memoria del lado del servidor.**
Sin eso, el `Set` crecería indefinidamente: cada persona que entró alguna vez
quedaría dentro, ocupando memoria y haciendo que cada broadcast recorra sockets
muertos. Se escuchan los dos eventos porque una conexión puede morir de formas
distintas; `leave` es idempotente para que llamarla dos veces no rompa nada.

### Mensaje entrante

```ts
ws.on("message", raw => {
  let event: ClientEvent | null = null;
  try {
    event = parseClientEvent(JSON.parse(String(raw)));
  } catch { event = null; }

  if (!event) {
    ws.send(JSON.stringify({ type: "ERROR", reason: "Mensaje inválido" }));
    return;
  }

  const base = { id: randomUUID(), roomId: room, user, timestamp: Date.now() };

  const message: Message =
    event.type === "CHAT"
      ? { ...base, kind: "text", text: event.text.trim().slice(0, 500) }
      : { ...base, kind: "reaction", reactionId: event.reactionId };

  if (message.kind === "text" && message.text.length === 0) return;

  addToHistory(room, message);
  broadcast(room, { type: "MESSAGE", message });
});
```

El `try/catch` alrededor de `JSON.parse` no es opcional: sin él, un cliente que
manda basura no-JSON provoca una excepción que **tira el proceso de Node entero**,
o sea que un cliente roto voltea el chat de todos.

El `ERROR` se envía con `ws.send`, no con `broadcast`: le llega solo a quien
mandó el mensaje inválido.

### Logs de verificación

En cada entrada y salida:

```
[boca-river] + Martina (2 conectados)
[boca-river] - Martina (1 conectado)
```

Convierte "confío en que se cerró la conexión" en "la terminal dice 0". También
hace visible el doble montaje de `StrictMode` en desarrollo.

---

## 7. Frontend

### Reparto de responsabilidades

```
App.tsx              qué pantalla se muestra
├── Home.tsx         nombre + elección de partido
└── Room.tsx         la sala
    ├── useRoomSocket.ts   toda la lógica del WebSocket
    ├── MessageList.tsx    historial + autoscroll
    ├── ReactionBar.tsx    botones de reacción
    └── ChatInput.tsx      input de texto
```

```tsx
const [session, setSession] = useState<{ roomId: RoomId; user: string } | null>(null);

return session
  ? <Room {...session} onLeave={() => setSession(null)} />
  : <Home onJoin={setSession} />;
```

`onLeave={() => setSession(null)}` parece trivial y es la pieza central: poner la
sesión en `null` desmonta `Room`, y desmontar `Room` dispara toda la cadena de
limpieza.

**Regla estructural: ningún componente visual toca el WebSocket.** `MessageList`
recibe mensajes y los dibuja; `ChatInput` avisa que el usuario escribió. Ninguno
sabe que existe una conexión. Toda la comunicación con el servidor pasa por el
hook, así que un cambio de protocolo toca un solo archivo.

### `useRoomSocket`

```ts
type Status = "connecting" | "open" | "closed" | "error";

export function useRoomSocket(roomId: RoomId, user: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus]     = useState<Status>("connecting");
  const [error, setError]       = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:8080?room=${roomId}&user=${encodeURIComponent(user)}`
    );
    socketRef.current = ws;

    ws.onopen  = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (e) => {
      const event: ServerEvent = JSON.parse(e.data);
      switch (event.type) {
        case "HISTORY": setMessages(event.messages); break;
        case "MESSAGE": setMessages(prev => [...prev, event.message]); break;
        case "ERROR":   setError(event.reason); break;
      }
    };

    return () => {
      // Se desenganchan los TRES handlers, no solo onmessage. Bajo StrictMode
      // el socket viejo termina de cerrarse DESPUÉS de que el nuevo abrió: si
      // su onclose siguiera vivo, pisaría el estado con "closed" y la sala
      // quedaría mostrando "desconectado" con el input deshabilitado mientras
      // en realidad sigue recibiendo mensajes.
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;

      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => ws.close(1000, "Salió de la sala");
      } else {
        ws.onopen = null;
        ws.close(1000, "Salió de la sala");
      }
      socketRef.current = null;
    };
  }, [roomId, user]);

  const send = useCallback((event: ClientEvent) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(event));
  }, []);

  return { messages, status, error, send };
}
```

`error` se muestra en `Room` como un aviso discreto sobre el input y se limpia al
enviar el mensaje siguiente. Es el único uso del evento `ERROR` del contrato.

#### Por qué el socket va en `useRef`

`useState` es para datos que al cambiar redibujan la pantalla. El socket no se
dibuja: guardarlo en estado provocaría re-renders inútiles y un ciclo donde el
render crea la conexión y la conexión provoca el render.

Una variable local tampoco sirve: se recrea en cada render, y la conexión se
perdería a la primera tecla.

`useRef` es la herramienta intermedia: una caja que sobrevive a todos los renders
y que al modificarse no dispara ninguno. Es el caso de uso canónico.

#### Por qué `setMessages(prev => [...prev, msg])` es obligatorio

`ws.onmessage` se crea **una sola vez**, al montar. En ese instante captura las
variables de ese render, incluido `messages`, que entonces era `[]`. La función
sigue viva toda la sesión pero sigue viendo esa foto congelada: es un
***stale closure***.

Con `setMessages([...messages, msg])`, cada mensaje produciría `[] + el nuevo` =
una lista de un solo elemento. El chat mostraría siempre el último mensaje y nada
más. El bug no se ve al probar rápido: se manda uno y aparece; recién al segundo
se nota que el primero desapareció.

La forma funcional pide a React el valor actual en lugar de usar el capturado.
En un listener asíncrono no es estilo: es corrección.

#### La función de limpieza

Lo que devuelve el `useEffect` corre al desmontar. Sin ella: el socket quedaría
abierto para siempre, seguiría llamando `setMessages` sobre un componente
inexistente, el servidor lo mantendría en el `Set` enviándole mensajes a nadie, y
entrar y salir cinco veces dejaría cinco conexiones vivas — con lo cual al volver
a entrar cada mensaje aparecería cinco veces.

**El `ws.close()` del cliente es el que dispara el `ws.on("close")` del servidor.
La limpieza del cliente y la del servidor son el mismo evento visto desde las dos
puntas.** Esto es lo que el README debe explicar.

#### El chequeo de `CONNECTING`

React 18 con `StrictMode` (activo por defecto en Vite) monta cada componente, lo
desmonta y lo vuelve a montar, precisamente para delatar efectos que no limpian
bien. Consecuencia: el efecto abre un socket y la limpieza intenta cerrarlo, a
menudo antes de que termine el handshake.

Cerrar un WebSocket en estado `CONNECTING` produce el warning
*"WebSocket is closed before the connection is established"*. El `if` lo resuelve
esperando a que la conexión se establezca para cerrarla ordenadamente.

**No desactivar `StrictMode` para silenciar ese warning.** `StrictMode` está
haciendo exactamente lo que promete: simular un desmontaje para verificar que la
limpieza sirva.

### Pantallas

**`Home`** — input controlado para el nombre; botones generados recorriendo
`MATCHES`, deshabilitados mientras el nombre esté vacío, con un texto suave de
ayuda ("Elegí un nombre para entrar") en lugar de un cartel de error. Al hacer
clic, `onJoin({ roomId, user })`.

**`Room`** — layout de tres franjas en columna:

- *Header:* "Sala en vivo: Boca vs. River", indicador de estado
  (Conectando… / En vivo / Se perdió la conexión, alimentado por `status`) y
  botón "Salir".
- *Centro:* `MessageList`, ocupa el alto disponible y scrollea. Mensajes propios
  a la derecha, ajenos a la izquierda, con autor y hora. "Propio" se determina
  comparando `message.user` con el nombre de la sesión: si dos personas eligen el
  mismo nombre, ambas verán los mensajes de la otra como propios. Es una
  limitación aceptada — resolverla bien exigiría un id de cliente asignado por el
  servidor, que no aporta a ningún criterio de evaluación. Las reacciones se
  dibujan distinto de los textos —más grandes, con el emoji protagonista— usando
  `kind` para decidir: la unión discriminada trabajando en la interfaz.
- *Pie:* `ReactionBar` (fila con scroll horizontal en móvil) y `ChatInput`.

**Autoscroll:** un `useRef` al final de la lista y un `useEffect` que hace
`scrollIntoView` al cambiar la cantidad de mensajes.

### Tailwind

Estructura clave: `h-screen flex flex-col` en el contenedor de la sala,
`flex-1 overflow-y-auto` en la lista de mensajes, header y pie con alto propio.
Así la zona de scroll es exactamente el espacio sobrante y el input queda siempre
visible, sin `position: fixed` ni cálculos de alto.

---

## 8. Tests

Acotados a `server/src/rooms.test.ts` con Vitest. `rooms.ts` es lógica pura: no
necesita navegador ni red. Los sockets se reemplazan por dobles mínimos
(`{ readyState: OPEN, send: vi.fn() }`).

Casos:

1. **Aislamiento:** un mensaje emitido a `boca-river` llega a los clientes de esa
   sala y **no** a los de `argentina-brasil`. Es la demostración directa del
   requisito que la consigna marca en negrita.
2. `leave` saca la conexión del `Set`.
3. `leave` llamada dos veces sobre la misma conexión no rompe.
4. El historial se recorta en `HISTORY_LIMIT` (50) conservando los más recientes.
5. `broadcast` no intenta enviar a un socket que no está `OPEN`.

No se testean componentes React: el costo se dispara y no aporta a los criterios
de evaluación.

---

## 9. Verificación manual

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Dos pestañas, misma sala | Lo que escribe una aparece al instante en la otra |
| 2 | Dos pestañas, salas distintas | Nada de una aparece en la otra |
| 3 | Entrar tarde a una sala con mensajes | Llega el historial |
| 4 | Salir al Home y volver a entrar | Se ve el historial, cada mensaje una sola vez |
| 5 | Entrar y salir cinco veces | El log del servidor reporta 0 conexiones al final |
| 6 | Cerrar la pestaña de golpe | Igual que 5 |
| 7 | Reacciones | Se ven distintas de los textos, en ambas pestañas |
| 8 | Recargar dentro de una sala | Vuelve al Home (comportamiento esperado) |
| 9 | Nombre vacío | Botones de partido deshabilitados |
| 10 | `npx tsc --noEmit` en client y server | Cero errores |
| 11 | Búsqueda de `any` en el código | Ninguna aparición |

Las pruebas 4, 5 y 6 son las que detectan una limpieza mal hecha.

---

## 10. Flujo de Git

Es el criterio 4 y **el único que no se puede recuperar después**: un commit
final gigante no permite fabricar un historial creíble.

```
feat/setup             estructura, Vite+Tailwind, Express arriba
feat/shared-types      shared/types.ts completo
feat/backend-rooms     rooms.ts + integración del WebSocketServer + tests
feat/frontend-layout   Home y Room maquetados, sin conexión
feat/websocket-client  useRoomSocket + integración real
feat/reactions         ReactionBar y el evento REACTION
docs/readme            README final
```

Cada rama sale de `main`, se trabaja con commits chicos y atómicos, y se integra
por Pull Request real en GitHub (el repo ya tiene remoto configurado). La
consigna dice "PR simulado" porque el trabajo es individual, pero el PR de verdad
cuesta lo mismo y queda mejor.

El orden no es arbitrario: `shared/types.ts` va segundo porque una vez que el
contrato existe, backend y frontend se escriben contra él sin ambigüedad.
`feat/frontend-layout` va antes de la conexión para resolver el diseño con datos
falsos y no pelear con el WebSocket al mismo tiempo: dos problemas de a uno.

**Regla: nada se commitea directo a `main`.**

---

## 11. README (segundo entregable)

1. Qué es la app y captura de pantalla
2. Stack y por qué `ws` nativo en vez de `socket.io`
3. Cómo levantarlo: requisitos, `npm install` y `npm run dev` en cada carpeta,
   qué puerto es cada cosa
4. **Cómo está estructurada la separación de salas en el backend** — el
   `Map<RoomId, Room>` y el argumento de que el aislamiento es estructural, no un
   filtro aplicado al enviar *(exigido por la consigna)*
5. **Cómo se limpian las conexiones al desmontar** — la función de limpieza del
   `useEffect` y el hecho de que el `close` del cliente y el del servidor son el
   mismo evento *(exigido por la consigna)*
6. Decisiones y limitaciones conscientes: historial en memoria, sin heartbeat,
   sin persistencia, sin reconexión
7. El extra de las reacciones rápidas y su motivación de producto

Los puntos 4 y 5 ya están redactados en las secciones 6 y 7 de este documento.

---

## 12. Relación con el ticket 7

El ticket 7 pide completar una evaluación teórica y enviar las respuestas al Tech
Lead. Sus tres bloques de material de estudio —ciclo de vida de `useEffect` y
`useRef`, uniones discriminadas en TypeScript, y la API de WebSockets— son
exactamente los conceptos aplicados en las secciones 5 y 7 de este diseño.

Las preguntas concretas de esa evaluación quedan fuera del alcance de este
diseño: no forman parte de los tickets. Este documento cubre únicamente el
challenge práctico del ticket 8.
