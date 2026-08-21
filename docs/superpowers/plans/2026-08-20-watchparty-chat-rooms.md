# Mini-WatchParty Chat Rooms — Plan de Implementación

> **Estado: documento previo a la implementación.**
> El código cambió después por hallazgos de code review, así que algunos
> pasajes de este documento ya no describen exactamente lo que se entregó.
> La fuente de verdad de lo implementado es el `README.md` de la raíz.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una app web donde el usuario elige entre dos partidos y entra a una sala de chat en vivo cuyos mensajes llegan únicamente a quienes están en esa misma sala.

**Architecture:** Dos proyectos npm independientes (`client`, `server`) y una carpeta `shared/` con el contrato de tipos que ambos importan. El servidor mantiene un `Map<RoomId, Room>` creado al arrancar, donde cada sala tiene un `Set` de conexiones y un historial acotado; el aislamiento es consecuencia de esa estructura, no de un filtro al enviar. El cliente concentra toda la lógica de WebSocket en un único hook (`useRoomSocket`) cuya función de limpieza cierra la conexión al desmontar la sala.

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind v4 (cliente); Node 22 + Express + `ws` nativo + TypeScript ejecutado con `tsx` (servidor); Vitest para tests.

**Spec:** `docs/superpowers/specs/2026-08-20-watchparty-chat-rooms-design.md`

## Global Constraints

Estas reglas aplican a **todas** las tareas.

- **Node 22 / npm 10.** Ya instalados.
- **Prohibido `any`.** En los bordes no tipados se usa `unknown` y se valida. La verificación final incluye una búsqueda de `any` en el código.
- **TypeScript en modo `strict`** en cliente y servidor.
- **`ws` nativo, nunca `socket.io`.** Es una decisión del diseño, no una preferencia.
- **Nada se commitea directo a `main`.** Cada tarea tiene su rama, y se integra por Pull Request real en GitHub (`git@github.com:MartinaCousido/CapacitacionWatchParty.git`).
- **Commits chicos y atómicos, mensajes en español**, con prefijo convencional (`feat:`, `chore:`, `test:`, `docs:`).
- **Todo commit lleva este pie:**
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01SCSZ8CbGnfoZhTgYoaKAEd
  ```
  Los comandos `git commit` del plan se escriben abreviados para que se lean; al ejecutarlos hay que agregar el pie.
- **Puertos:** cliente `5173`, servidor `8080`.
- **Constantes del dominio:** `HISTORY_LIMIT = 50`, `MAX_TEXT_LENGTH = 500`, `MAX_USER_LENGTH = 24`.
- **`StrictMode` queda activado.** El doble montaje que provoca en desarrollo es deseado: delata limpiezas mal hechas.
- **Los tests cubren solo `server/src/`.** No se testean componentes de React.
- **Imports de tipos:** usar `import type { X }` o `import { valor, type Tipo }`. Las plantillas de Vite activan `verbatimModuleSyntax`, que rechaza importar un tipo como si fuera un valor.

### Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `shared/types.ts` | Contrato del socket: listas de partidos y reacciones, tipos de mensaje y evento, validadores de borde |
| `server/src/rooms.ts` | Estado de las salas: quién está conectado, qué se dijo, y el broadcast aislado |
| `server/src/rooms.test.ts` | Tests de aislamiento, limpieza y recorte de historial |
| `server/src/types.test.ts` | Tests de los validadores de `shared/types.ts` |
| `server/src/index.ts` | Express + servidor HTTP + `WebSocketServer` + ciclo de vida de cada conexión |
| `client/src/App.tsx` | Decide qué pantalla se muestra |
| `client/src/screens/Home.tsx` | Nombre de usuario + elección de partido |
| `client/src/screens/Room.tsx` | Layout de la sala y cableado del hook |
| `client/src/hooks/useRoomSocket.ts` | Toda la lógica de WebSocket del cliente |
| `client/src/components/MessageList.tsx` | Historial + autoscroll |
| `client/src/components/ChatInput.tsx` | Input de texto |
| `client/src/components/ReactionBar.tsx` | Botones de reacción |
| `README.md` | Segundo entregable |

---

## Tarea 1: Integrar el diseño a `main` y preparar el terreno

**Files:**
- Ya creados en la rama `docs/design-spec`: `.gitignore`, `docs/superpowers/specs/2026-08-20-watchparty-chat-rooms-design.md`
- Create: `docs/superpowers/plans/2026-08-20-watchparty-chat-rooms.md` (este archivo)

**Interfaces:**
- Consumes: nada
- Produces: una `main` limpia con `.gitignore`, spec y plan, desde la cual salen todas las ramas siguientes

- [ ] **Step 1: Commitear este plan en la rama del diseño**

```bash
git add docs/superpowers/plans/2026-08-20-watchparty-chat-rooms.md
git commit -m "docs: agregar plan de implementacion"
```

- [ ] **Step 2: Subir la rama y abrir el Pull Request**

```bash
git push -u origin docs/design-spec
gh pr create --base main --head docs/design-spec \
  --title "docs: diseño y plan de implementacion" \
  --body "Documento de diseño validado y plan de implementacion tarea por tarea. Incluye .gitignore para excluir .DS_Store y .idea/ de la entrega."
```

- [ ] **Step 3: Mergear el PR y volver a `main`**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull
```

- [ ] **Step 4: Verificar que el repositorio quedó limpio**

Run: `git status --short`
Expected: salida vacía. Si aparecen `.DS_Store` o `.idea/`, el `.gitignore` no se aplicó — revisar que esté en la raíz.

Run: `git log --oneline -4`
Expected: se ven los commits del diseño, del plan y del `.gitignore` sobre `main`.

---

## Tarea 2: Scaffolding del cliente y del servidor

Esta tarea no tiene tests: su entregable es que ambos proyectos levanten. Se verifica ejecutándolos.

**Files:**
- Create: `client/` completo (plantilla de Vite) + `client/vite.config.ts` modificado + `client/tsconfig.app.json` modificado + `client/src/index.css` reemplazado
- Create: `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`

**Interfaces:**
- Consumes: nada
- Produces: `npm run dev` funcionando en ambas carpetas; `GET http://localhost:8080/health` devolviendo `{ ok: true }`

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b feat/setup
```

- [ ] **Step 2: Generar el cliente con Vite**

```bash
npm create vite@latest client -- --template react-ts
cd client && npm install && cd ..
```

- [ ] **Step 3: Instalar Tailwind v4 en el cliente**

```bash
cd client && npm install -D tailwindcss@4 @tailwindcss/vite@4 && cd ..
```

Tailwind v4 no usa `tailwind.config.js` ni PostCSS: se instala como plugin de Vite y se activa con una línea de CSS. No hay que crear archivos de configuración.

- [ ] **Step 4: Configurar Vite**

Reemplazar `client/vite.config.ts` por:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Permite importar archivos de ../shared, que está fuera de client/
    fs: { allow: [".."] },
  },
});
```

- [ ] **Step 5: Permitir que TypeScript vea `shared/`**

En `client/tsconfig.app.json`, dentro de `compilerOptions` agregar:

```json
"rootDir": ".."
```

y cambiar el `include` del final del archivo por:

```json
"include": ["src", "../shared"]
```

`rootDir: ".."` es necesario porque la plantilla de Vite usa project references: sin él, importar un archivo que vive fuera de `client/` produce el error TS6059 ("File is not under rootDir").

- [ ] **Step 6: Activar Tailwind y poner el fondo base**

Reemplazar **todo** el contenido de `client/src/index.css` por:

```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
}

body {
  @apply bg-slate-950 text-slate-100 antialiased;
}
```

Borrar `client/src/App.css` (la plantilla lo trae y no se usa) y quitar su import de `client/src/App.tsx`.

- [ ] **Step 7: Verificar que el cliente levanta con Tailwind aplicado**

Run: `cd client && npm run dev`
Expected: arranca en `http://localhost:5173` y la página se ve con **fondo oscuro** (si el fondo es blanco, Tailwind no se activó: revisar el plugin en `vite.config.ts` y el `@import` del CSS). Cortar con Ctrl+C.

- [ ] **Step 8: Crear el servidor**

```bash
mkdir server && cd server
npm init -y
npm install express ws
npm install -D typescript tsx vitest @types/express @types/ws @types/node
cd ..
```

- [ ] **Step 9: Configurar los scripts del servidor**

En `server/package.json`, reemplazar el bloque `"scripts"` por:

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit"
}
```

No agregar `"type": "module"`: `tsx` transpila los `import` sin problema y así se evitan conflictos de resolución de módulos con `shared/`.

- [ ] **Step 10: Crear `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src", "../shared"]
}
```

- [ ] **Step 11: Crear `server/src/index.ts` mínimo**

```ts
import http from "node:http";
import express from "express";

const PORT = Number(process.env.PORT ?? 8080);

const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
```

- [ ] **Step 12: Verificar que el servidor levanta**

Run (en una terminal): `cd server && npm run dev`
Expected: `Servidor escuchando en http://localhost:8080`

Run (en otra terminal): `curl -s http://localhost:8080/health`
Expected: `{"ok":true}`

Cortar el servidor con Ctrl+C.

- [ ] **Step 13: Verificar los tipos**

Run: `cd server && npm run typecheck`
Expected: sin salida (cero errores).

- [ ] **Step 14: Commitear**

```bash
git add .
git commit -m "feat: scaffolding de cliente y servidor

Cliente con Vite + React + TypeScript + Tailwind v4, configurado para
importar tipos desde ../shared. Servidor con Express y TypeScript
ejecutado por tsx, con endpoint /health."
```

- [ ] **Step 15: Integrar por Pull Request**

```bash
git push -u origin feat/setup
gh pr create --base main --title "feat: scaffolding de cliente y servidor" \
  --body "Estructura base de los dos proyectos. Sin logica de dominio todavia."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Tarea 3: El contrato compartido (`shared/types.ts`)

**Files:**
- Create: `shared/types.ts`
- Test: `server/src/types.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `MATCHES: readonly { id, label }[]`, `RoomId = "boca-river" | "argentina-brasil"`
  - `REACTIONS: readonly { id, emoji, label }[]`, `ReactionId`
  - `MAX_TEXT_LENGTH = 500`, `MAX_USER_LENGTH = 24`
  - `Message` (unión discriminada por `kind`: `"text"` | `"reaction"`)
  - `ClientEvent` (`CHAT` | `REACTION`), `ServerEvent` (`HISTORY` | `MESSAGE` | `ERROR`)
  - `isRoomId(value: unknown): value is RoomId`
  - `isReactionId(value: unknown): value is ReactionId`
  - `parseClientEvent(raw: unknown): ClientEvent | null`

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b feat/shared-types
```

- [ ] **Step 2: Escribir el test que falla**

Crear `server/src/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isRoomId, isReactionId, parseClientEvent } from "../../shared/types";

describe("isRoomId", () => {
  it("acepta una sala que existe", () => {
    expect(isRoomId("boca-river")).toBe(true);
  });

  it("rechaza una sala inventada", () => {
    expect(isRoomId("sala-pirata")).toBe(false);
  });

  it("rechaza valores que no son string", () => {
    expect(isRoomId(42)).toBe(false);
    expect(isRoomId(null)).toBe(false);
  });
});

describe("isReactionId", () => {
  it("acepta una reaccion que existe", () => {
    expect(isReactionId("gol")).toBe(true);
  });

  it("rechaza una reaccion inventada", () => {
    expect(isReactionId("insulto-libre")).toBe(false);
  });
});

describe("parseClientEvent", () => {
  it("acepta un CHAT con texto", () => {
    expect(parseClientEvent({ type: "CHAT", text: "vamos" }))
      .toEqual({ type: "CHAT", text: "vamos" });
  });

  it("rechaza un CHAT sin texto", () => {
    expect(parseClientEvent({ type: "CHAT" })).toBeNull();
  });

  it("rechaza un CHAT cuyo texto no es string", () => {
    expect(parseClientEvent({ type: "CHAT", text: 123 })).toBeNull();
  });

  it("acepta una REACTION con id valido", () => {
    expect(parseClientEvent({ type: "REACTION", reactionId: "gol" }))
      .toEqual({ type: "REACTION", reactionId: "gol" });
  });

  it("rechaza una REACTION con id inventado", () => {
    expect(parseClientEvent({ type: "REACTION", reactionId: "inventada" })).toBeNull();
  });

  it("descarta campos de mas en lugar de reenviarlos", () => {
    expect(parseClientEvent({ type: "CHAT", text: "hola", user: "impostor" }))
      .toEqual({ type: "CHAT", text: "hola" });
  });

  it("rechaza un tipo desconocido", () => {
    expect(parseClientEvent({ type: "DROP_DATABASE" })).toBeNull();
  });

  it("rechaza valores que no son objetos", () => {
    expect(parseClientEvent(null)).toBeNull();
    expect(parseClientEvent("CHAT")).toBeNull();
    expect(parseClientEvent(undefined)).toBeNull();
  });
});
```

El test *"descarta campos de mas"* es el que protege la regla de que el servidor nunca cree la identidad que declara el cliente: aunque llegue un `user` en el payload, el parser no lo deja pasar.

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `cd server && npm test`
Expected: FAIL — no se puede resolver `../../shared/types`.

- [ ] **Step 4: Escribir `shared/types.ts`**

```ts
// Contrato unico de datos entre cliente y servidor.
// Este archivo no importa nada: lo consumen los dos lados por igual.

export const MATCHES = [
  { id: "boca-river", label: "Boca vs. River" },
  { id: "argentina-brasil", label: "Argentina vs. Brasil" },
] as const;

export type RoomId = (typeof MATCHES)[number]["id"];

export const REACTIONS = [
  { id: "gol", emoji: "⚽", label: "¡GOL!" },
  { id: "vamos", emoji: "👏", label: "Vamos" },
  { id: "nolopuedocreer", emoji: "😱", label: "No lo puedo creer" },
  { id: "robo", emoji: "🤬", label: "Robo" },
  { id: "jugada", emoji: "🙌", label: "Qué jugada" },
] as const;

export type ReactionId = (typeof REACTIONS)[number]["id"];

export const MAX_TEXT_LENGTH = 500;
export const MAX_USER_LENGTH = 24;

interface BaseMessage {
  id: string;
  roomId: RoomId;
  user: string;
  /** Epoch en milisegundos. No se usa Date porque JSON no tiene fechas. */
  timestamp: number;
}

export type Message =
  | (BaseMessage & { kind: "text"; text: string })
  | (BaseMessage & { kind: "reaction"; reactionId: ReactionId });

export type ClientEvent =
  | { type: "CHAT"; text: string }
  | { type: "REACTION"; reactionId: ReactionId };

export type ServerEvent =
  | { type: "HISTORY"; messages: Message[] }
  | { type: "MESSAGE"; message: Message }
  | { type: "ERROR"; reason: string };

export function isRoomId(value: unknown): value is RoomId {
  return typeof value === "string" && MATCHES.some((match) => match.id === value);
}

export function isReactionId(value: unknown): value is ReactionId {
  return typeof value === "string" && REACTIONS.some((reaction) => reaction.id === value);
}

/**
 * Frontera del sistema: lo que llega por el socket es JSON sin tipar.
 * Se acepta `unknown` (no `any`) para estar obligados a comprobar antes de tocar,
 * y se devuelve un evento reconstruido campo por campo o `null`.
 */
export function parseClientEvent(raw: unknown): ClientEvent | null {
  if (typeof raw !== "object" || raw === null) return null;

  const candidate = raw as Record<string, unknown>;

  if (candidate.type === "CHAT") {
    return typeof candidate.text === "string"
      ? { type: "CHAT", text: candidate.text }
      : null;
  }

  if (candidate.type === "REACTION") {
    return isReactionId(candidate.reactionId)
      ? { type: "REACTION", reactionId: candidate.reactionId }
      : null;
  }

  return null;
}
```

El evento se **reconstruye** campo por campo en lugar de devolver `raw` con un cast. Por eso el test de los campos de más pasa: lo que no está en el contrato nunca entra al sistema.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd server && npm test`
Expected: PASS, 13 tests.

- [ ] **Step 6: Verificar los tipos**

Run: `cd server && npm run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commitear**

```bash
git add shared/types.ts server/src/types.test.ts
git commit -m "feat: agregar contrato de tipos compartido

Uniones discriminadas para los eventos del socket y validadores de
borde (isRoomId, isReactionId, parseClientEvent). El parser reconstruye
el evento campo por campo para que ningun dato fuera del contrato entre
al sistema."
```

- [ ] **Step 8: Integrar por Pull Request**

```bash
git push -u origin feat/shared-types
gh pr create --base main --title "feat: contrato de tipos compartido" \
  --body "shared/types.ts con las uniones discriminadas del protocolo y la validacion del borde. 13 tests."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Tarea 4: El registro de salas (`server/src/rooms.ts`)

Es el criterio 2 de la evaluación. Lógica pura, sin red ni navegador.

**Files:**
- Create: `server/src/rooms.ts`
- Test: `server/src/rooms.test.ts`

**Interfaces:**
- Consumes: `MATCHES`, `Message`, `RoomId`, `ServerEvent` de `shared/types`
- Produces:
  - `interface Client { readyState: number; send(data: string): void }`
  - `HISTORY_LIMIT = 50`
  - `resetRooms(): void`
  - `join(roomId: RoomId, client: Client): void`
  - `leave(roomId: RoomId, client: Client): void`
  - `countClients(roomId: RoomId): number`
  - `getHistory(roomId: RoomId): Message[]`
  - `addToHistory(roomId: RoomId, message: Message): void`
  - `broadcast(roomId: RoomId, event: ServerEvent): void`

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b feat/backend-rooms
```

- [ ] **Step 2: Escribir el test que falla**

Crear `server/src/rooms.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  join, leave, broadcast, addToHistory, getHistory,
  countClients, resetRooms, HISTORY_LIMIT, type Client,
} from "./rooms";
import type { Message } from "../../shared/types";

const OPEN = 1;
const CLOSED = 3;

/** Doble minimo de una conexion: solo lo que `broadcast` necesita. */
function fakeClient(readyState: number = OPEN) {
  return { readyState, send: vi.fn() } satisfies Client;
}

function textMessage(text: string): Message {
  return {
    id: `id-${text}`,
    roomId: "boca-river",
    user: "Tester",
    timestamp: 0,
    kind: "text",
    text,
  };
}

beforeEach(() => {
  resetRooms();
});

describe("aislamiento entre salas", () => {
  it("un mensaje de boca-river no llega a los clientes de argentina-brasil", () => {
    const enBoca = fakeClient();
    const enArgentina = fakeClient();

    join("boca-river", enBoca);
    join("argentina-brasil", enArgentina);

    broadcast("boca-river", { type: "MESSAGE", message: textMessage("dale Boca") });

    expect(enBoca.send).toHaveBeenCalledTimes(1);
    expect(enArgentina.send).not.toHaveBeenCalled();
  });

  it("llega a todos los clientes de la misma sala", () => {
    const uno = fakeClient();
    const dos = fakeClient();
    join("boca-river", uno);
    join("boca-river", dos);

    broadcast("boca-river", { type: "MESSAGE", message: textMessage("hola") });

    expect(uno.send).toHaveBeenCalledTimes(1);
    expect(dos.send).toHaveBeenCalledTimes(1);
  });
});

describe("limpieza de conexiones", () => {
  it("leave saca la conexion de la sala", () => {
    const cliente = fakeClient();
    join("boca-river", cliente);
    expect(countClients("boca-river")).toBe(1);

    leave("boca-river", cliente);
    expect(countClients("boca-river")).toBe(0);
  });

  it("leave dos veces sobre la misma conexion no rompe", () => {
    const cliente = fakeClient();
    join("boca-river", cliente);

    leave("boca-river", cliente);
    expect(() => leave("boca-river", cliente)).not.toThrow();
    expect(countClients("boca-river")).toBe(0);
  });

  it("una conexion que salio ya no recibe mensajes", () => {
    const cliente = fakeClient();
    join("boca-river", cliente);
    leave("boca-river", cliente);

    broadcast("boca-river", { type: "MESSAGE", message: textMessage("tarde") });

    expect(cliente.send).not.toHaveBeenCalled();
  });
});

describe("broadcast", () => {
  it("no intenta enviar a una conexion que no esta abierta", () => {
    const cerrado = fakeClient(CLOSED);
    join("boca-river", cerrado);

    broadcast("boca-river", { type: "MESSAGE", message: textMessage("hola") });

    expect(cerrado.send).not.toHaveBeenCalled();
  });
});

describe("historial", () => {
  it("guarda los mensajes en orden", () => {
    addToHistory("boca-river", textMessage("uno"));
    addToHistory("boca-river", textMessage("dos"));

    const historial = getHistory("boca-river");
    expect(historial).toHaveLength(2);
    expect(historial[0].kind === "text" && historial[0].text).toBe("uno");
  });

  it("el historial de una sala no contamina el de la otra", () => {
    addToHistory("boca-river", textMessage("uno"));
    expect(getHistory("argentina-brasil")).toHaveLength(0);
  });

  it(`se recorta en ${HISTORY_LIMIT} conservando los mas recientes`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      addToHistory("boca-river", textMessage(String(i)));
    }

    const historial = getHistory("boca-river");
    expect(historial).toHaveLength(HISTORY_LIMIT);

    const primero = historial[0];
    expect(primero.kind === "text" && primero.text).toBe("10");
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `cd server && npm test`
Expected: FAIL — no se puede resolver `./rooms`.

- [ ] **Step 4: Escribir `server/src/rooms.ts`**

```ts
import { MATCHES, type Message, type RoomId, type ServerEvent } from "../../shared/types";

export const HISTORY_LIMIT = 50;

/** Valor de WebSocket.OPEN. Se declara aca para no depender de `ws` en los tests. */
const OPEN = 1;

/**
 * Lo minimo que el registro necesita de una conexion.
 * `WebSocket` de la libreria `ws` lo cumple estructuralmente, y en los tests
 * se puede pasar un objeto plano sin castear nada.
 */
export interface Client {
  readyState: number;
  send(data: string): void;
}

interface Room {
  clients: Set<Client>;
  history: Message[];
}

let rooms = new Map<RoomId, Room>();

/**
 * Crea una sala por cada partido. Se llama al arrancar el servidor y al
 * empezar cada test. Que las salas existan desde el segundo cero elimina
 * toda pregunta sobre crearlas o borrarlas en caliente.
 */
export function resetRooms(): void {
  rooms = new Map<RoomId, Room>(
    MATCHES.map((match): [RoomId, Room] => [
      match.id,
      { clients: new Set<Client>(), history: [] },
    ]),
  );
}

resetRooms();

export function join(roomId: RoomId, client: Client): void {
  rooms.get(roomId)?.clients.add(client);
}

/** Idempotente: `Set.delete` sobre algo que no esta simplemente devuelve false. */
export function leave(roomId: RoomId, client: Client): void {
  rooms.get(roomId)?.clients.delete(client);
}

export function countClients(roomId: RoomId): number {
  return rooms.get(roomId)?.clients.size ?? 0;
}

export function getHistory(roomId: RoomId): Message[] {
  return rooms.get(roomId)?.history ?? [];
}

export function addToHistory(roomId: RoomId, message: Message): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.history.push(message);

  if (room.history.length > HISTORY_LIMIT) {
    room.history = room.history.slice(-HISTORY_LIMIT);
  }
}

/**
 * El aislamiento entre salas vive aca, y es estructural: el bucle recorre el
 * Set de ESTA sala. Las conexiones de las otras estan en otro Set, en otra
 * entrada del Map, y este codigo no tiene forma de alcanzarlas.
 */
export function broadcast(roomId: RoomId, event: ServerEvent): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const data = JSON.stringify(event); // se serializa una sola vez, no una por cliente

  for (const client of room.clients) {
    if (client.readyState === OPEN) {
      client.send(data);
    }
  }
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd server && npm test`
Expected: PASS, 22 tests en total (13 de `types.test.ts` + 9 de `rooms.test.ts`).

- [ ] **Step 6: Verificar los tipos**

Run: `cd server && npm run typecheck`
Expected: sin errores.

- [ ] **Step 7: Commitear**

```bash
git add server/src/rooms.ts server/src/rooms.test.ts
git commit -m "feat: agregar registro de salas con broadcast aislado

Map<RoomId, Room> creado al arrancar, con un Set de conexiones y un
historial acotado a 50 mensajes por sala. El aislamiento es consecuencia
de la estructura: broadcast solo recorre el Set de su propia sala.

Tests: aislamiento entre salas, limpieza idempotente, recorte de
historial y omision de conexiones no abiertas."
```

- [ ] **Step 8: Integrar por Pull Request**

```bash
git push -u origin feat/backend-rooms
gh pr create --base main --title "feat: registro de salas con broadcast aislado" \
  --body "Estado de las salas y broadcast filtrado, con 9 tests que cubren el aislamiento y la limpieza."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Tarea 5: El servidor WebSocket (`server/src/index.ts`)

**Files:**
- Modify: `server/src/index.ts` (reemplazo completo)

**Interfaces:**
- Consumes: todo lo que exportan `shared/types` y `server/src/rooms`
- Produces: un servidor que acepta `ws://localhost:8080?room=<id>&user=<nombre>`, responde con `HISTORY` al conectar, retransmite `MESSAGE` a la sala y emite `ERROR` a quien manda un payload inválido

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b feat/websocket-server
```

- [ ] **Step 2: Reemplazar `server/src/index.ts`**

```ts
import { randomUUID } from "node:crypto";
import http from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import {
  MAX_TEXT_LENGTH,
  MAX_USER_LENGTH,
  isRoomId,
  parseClientEvent,
  type ClientEvent,
  type Message,
} from "../../shared/types";
import { addToHistory, broadcast, countClients, getHistory, join, leave } from "./rooms";

const PORT = Number(process.env.PORT ?? 8080);

const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Express y el WebSocket comparten servidor HTTP y puerto: un WebSocket empieza
// como una peticion HTTP que pide convertirse (upgrade), y WebSocketServer se
// engancha a esas peticiones dejando el resto a Express.
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const room = url.searchParams.get("room") ?? "";
  const user = (url.searchParams.get("user") ?? "").trim().slice(0, MAX_USER_LENGTH);

  // Toda conexion nace perteneciendo a una sala valida, o no nace.
  if (!isRoomId(room) || user.length === 0) {
    ws.close(4004, "Sala o usuario invalidos");
    return;
  }

  join(room, ws);
  console.log(`[${room}] + ${user} (${countClients(room)} conectados)`);

  ws.send(JSON.stringify({ type: "HISTORY", messages: getHistory(room) }));

  ws.on("message", (raw) => {
    let event: ClientEvent | null = null;
    try {
      event = parseClientEvent(JSON.parse(raw.toString()));
    } catch {
      // Sin este catch, un cliente que manda algo que no es JSON tira el
      // proceso entero de Node y deja sin chat a todos los demas.
      event = null;
    }

    if (!event) {
      ws.send(JSON.stringify({ type: "ERROR", reason: "Mensaje invalido" }));
      return;
    }

    // El autor, la hora y el id los pone el servidor: el cliente solo aporta
    // contenido. `user` viene del handshake, no del payload.
    const base = { id: randomUUID(), roomId: room, user, timestamp: Date.now() };

    let message: Message;
    if (event.type === "CHAT") {
      const text = event.text.trim().slice(0, MAX_TEXT_LENGTH);
      if (text.length === 0) return;
      message = { ...base, kind: "text", text };
    } else {
      message = { ...base, kind: "reaction", reactionId: event.reactionId };
    }

    addToHistory(room, message);
    broadcast(room, { type: "MESSAGE", message });
  });

  // Sin esto el Set crece para siempre: cada persona que entro alguna vez
  // quedaria dentro y cada broadcast recorreria sockets muertos.
  let alreadyLeft = false;
  const disconnect = () => {
    if (alreadyLeft) return;
    alreadyLeft = true;
    leave(room, ws);
    console.log(`[${room}] - ${user} (${countClients(room)} conectados)`);
  };

  ws.on("close", disconnect);
  ws.on("error", disconnect);
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
```

- [ ] **Step 3: Verificar los tipos y que los tests siguen pasando**

Run: `cd server && npm run typecheck && npm test`
Expected: sin errores de tipos; 22 tests PASS.

- [ ] **Step 4: Crear el script de verificación manual**

Conecta tres clientes —dos a una sala y uno a la otra— y comprueba el aislamiento punta a punta.

El archivo tiene que vivir **dentro de `server/`**: Node resuelve `import "ws"` desde la ubicación del script, no desde el directorio actual, así que fuera de esa carpeta no encontraría el paquete. Es una herramienta de verificación descartable, no parte de la entrega, así que se excluye del repositorio.

Primero, agregar al final de `.gitignore` (en la raíz):

```
# Script descartable de verificacion manual
server/verify-isolation.mjs
```

Crear `server/verify-isolation.mjs`:

```js
// `ws` es CommonJS: se importa por defecto para no depender de la
// deteccion de exports nombrados que hace Node al cargarlo desde un .mjs
import WebSocket from "ws";

const URL_BASE = "ws://localhost:8080";
const recibido = { bocaA: [], bocaB: [], argentina: [] };

function conectar(nombre, room, user) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${URL_BASE}?room=${room}&user=${user}`);
    ws.on("message", (raw) => {
      const evento = JSON.parse(raw.toString());
      if (evento.type === "MESSAGE") recibido[nombre].push(evento.message.text);
    });
    ws.on("open", () => resolve(ws));
  });
}

const bocaA = await conectar("bocaA", "boca-river", "Martina");
const bocaB = await conectar("bocaB", "boca-river", "Test");
const argentina = await conectar("argentina", "argentina-brasil", "Otro");

bocaA.send(JSON.stringify({ type: "CHAT", text: "dale Boca" }));
await new Promise((r) => setTimeout(r, 300));

console.log("bocaA recibio:    ", recibido.bocaA);
console.log("bocaB recibio:    ", recibido.bocaB);
console.log("argentina recibio:", recibido.argentina);

const ok =
  recibido.bocaA.length === 1 &&
  recibido.bocaB.length === 1 &&
  recibido.argentina.length === 0;

console.log(ok ? "\n✅ AISLAMIENTO OK" : "\n❌ FALLO EL AISLAMIENTO");

for (const ws of [bocaA, bocaB, argentina]) ws.close();
process.exit(ok ? 0 : 1);
```

- [ ] **Step 5: Verificar el aislamiento punta a punta**

Run (terminal 1): `cd server && npm run dev`

Run (terminal 2): `cd server && node verify-isolation.mjs`

Expected:
```
bocaA recibio:     [ 'dale Boca' ]
bocaB recibio:     [ 'dale Boca' ]
argentina recibio: []

✅ AISLAMIENTO OK
```

En la terminal 1 tienen que verse las tres entradas y, al terminar el script, las tres salidas con el contador bajando a 0:

```
[boca-river] + Martina (1 conectados)
[boca-river] + Test (2 conectados)
[argentina-brasil] + Otro (1 conectados)
...
[boca-river] - Martina (0 conectados)
```

- [ ] **Step 6: Verificar el rechazo de salas inventadas**

Run (con el servidor levantado):
```bash
node -e "const {WebSocket}=require('ws');const w=new WebSocket('ws://localhost:8080?room=sala-pirata&user=X');w.on('close',(c)=>{console.log('cerrado con codigo',c);process.exit(0)})"
```
desde la carpeta `server/`.
Expected: `cerrado con codigo 4004`

Cortar el servidor con Ctrl+C.

- [ ] **Step 7: Commitear**

```bash
git add server/src/index.ts .gitignore
git commit -m "feat: conectar el servidor WebSocket al registro de salas

La sala y el usuario viajan en el handshake y se validan antes de
aceptar la conexion. El servidor asigna id, autor y timestamp de cada
mensaje: el cliente solo aporta contenido. Al cerrarse la conexion se
la saca del registro, y se loguea el conteo por sala para poder
verificar que no queden conexiones colgadas."
```

- [ ] **Step 8: Integrar por Pull Request**

```bash
git push -u origin feat/websocket-server
gh pr create --base main --title "feat: servidor WebSocket con salas aisladas" \
  --body "Ciclo de vida completo de la conexion: handshake validado, historial al entrar, broadcast por sala y limpieza al cerrar."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Tarea 6: Maquetado del frontend (sin conexión)

Se resuelve el diseño con datos falsos para no pelear con el WebSocket y con Tailwind al mismo tiempo.

**Files:**
- Modify: `client/src/App.tsx` (reemplazo completo)
- Create: `client/src/screens/Home.tsx`, `client/src/screens/Room.tsx`
- Create: `client/src/components/MessageList.tsx`, `client/src/components/ChatInput.tsx`

**Interfaces:**
- Consumes: `MATCHES`, `REACTIONS`, `Message`, `RoomId` de `shared/types`
- Produces:
  - `type Session = { roomId: RoomId; user: string }` exportado desde `App.tsx`
  - `<Home onJoin={(s: Session) => void} />`
  - `<Room roomId={RoomId} user={string} onLeave={() => void} />`
  - `<MessageList messages={Message[]} currentUser={string} />`
  - `<ChatInput onSend={(text: string) => void} disabled={boolean} />`

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b feat/frontend-layout
```

- [ ] **Step 2: Reemplazar `client/src/App.tsx`**

```tsx
import { useState } from "react";
import type { RoomId } from "../../shared/types";
import Home from "./screens/Home";
import Room from "./screens/Room";

export type Session = { roomId: RoomId; user: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  // Poner la sesion en null desmonta Room, y desmontar Room es lo que
  // dispara la limpieza del WebSocket.
  return session ? (
    <Room roomId={session.roomId} user={session.user} onLeave={() => setSession(null)} />
  ) : (
    <Home onJoin={setSession} />
  );
}
```

- [ ] **Step 3: Crear `client/src/screens/Home.tsx`**

```tsx
import { useState } from "react";
import { MATCHES, MAX_USER_LENGTH } from "../../../shared/types";
import type { Session } from "../App";

type Props = { onJoin: (session: Session) => void };

export default function Home({ onJoin }: Props) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const canJoin = trimmed.length > 0;

  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-center">WatchParty</h1>
        <p className="mt-2 text-center text-slate-400">
          Elegí un partido y sumate a la hinchada.
        </p>

        <label className="mt-8 block">
          <span className="text-sm font-medium text-slate-300">Tu nombre</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_USER_LENGTH}
            placeholder="Fan_123"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3
                       text-slate-100 placeholder:text-slate-600
                       focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <div className="mt-6 space-y-3">
          {MATCHES.map((match) => (
            <button
              key={match.id}
              type="button"
              disabled={!canJoin}
              onClick={() => onJoin({ roomId: match.id, user: trimmed })}
              className="w-full rounded-xl border border-slate-800 bg-gradient-to-r
                         from-slate-900 to-slate-800 px-5 py-4 text-left text-lg font-semibold
                         transition hover:border-emerald-600 hover:from-slate-800
                         disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-800"
            >
              {match.label}
              <span className="ml-2 text-sm font-normal text-emerald-400">· en vivo</span>
            </button>
          ))}
        </div>

        {!canJoin && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Elegí un nombre para entrar.
          </p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Crear `client/src/components/MessageList.tsx`**

```tsx
import { useEffect, useRef } from "react";
import { REACTIONS, type Message } from "../../../shared/types";

type Props = { messages: Message[]; currentUser: string };

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageList({ messages, currentUser }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600">
        Todavía no dijo nada nadie. Empezá vos.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((message) => {
        // "Propio" se decide por nombre. Si dos personas eligen el mismo,
        // ambas se ven reflejadas: limitacion aceptada en el diseño.
        const isOwn = message.user === currentUser;
        const reaction =
          message.kind === "reaction"
            ? REACTIONS.find((item) => item.id === message.reactionId)
            : undefined;

        return (
          <div key={message.id} className={isOwn ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[75%]">
              <div className="mb-1 flex items-baseline gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-400">{message.user}</span>
                <span>{formatTime(message.timestamp)}</span>
              </div>

              {message.kind === "text" ? (
                <p
                  className={`rounded-2xl px-4 py-2 ${
                    isOwn ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {message.text}
                </p>
              ) : (
                <p className="rounded-2xl bg-slate-900 border border-slate-700 px-4 py-2 text-2xl">
                  <span>{reaction ? reaction.emoji : "❓"}</span>
                  <span className="ml-2 align-middle text-base font-semibold text-amber-300">
                    {reaction ? reaction.label : message.reactionId}
                  </span>
                </p>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
```

Fijate en el `message.kind === "text" ? ... : ...`: dentro de la primera rama TypeScript sabe que existe `message.text`, y dentro de la segunda que existe `message.reactionId`. Es la unión discriminada trabajando en la interfaz.

- [ ] **Step 5: Crear `client/src/components/ChatInput.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { MAX_TEXT_LENGTH } from "../../../shared/types";

type Props = { onSend: (text: string) => void; disabled: boolean };

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (value.length === 0) return;
    onSend(value);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 px-4 pb-4">
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX_TEXT_LENGTH}
        disabled={disabled}
        placeholder="Escribí un comentario…"
        className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-3
                   text-slate-100 placeholder:text-slate-600
                   focus:border-emerald-500 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white
                   transition hover:bg-emerald-500
                   disabled:cursor-not-allowed disabled:opacity-40"
      >
        Enviar
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Crear `client/src/screens/Room.tsx` con datos falsos**

```tsx
import { MATCHES, type Message, type RoomId } from "../../../shared/types";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";

type Props = { roomId: RoomId; user: string; onLeave: () => void };

// Datos falsos: en la tarea 7 los reemplaza el hook del WebSocket.
const FAKE_MESSAGES: Message[] = [
  { id: "1", roomId: "boca-river", user: "Fan_101", timestamp: Date.now() - 60000,
    kind: "text", text: "Arranca el partido" },
  { id: "2", roomId: "boca-river", user: "Fan_202", timestamp: Date.now() - 30000,
    kind: "reaction", reactionId: "gol" },
  { id: "3", roomId: "boca-river", user: "Martina", timestamp: Date.now(),
    kind: "text", text: "No lo puedo creer" },
];

export default function Room({ roomId, user, onLeave }: Props) {
  const match = MATCHES.find((item) => item.id === roomId);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="font-semibold">Sala en vivo: {match ? match.label : roomId}</h1>
          <p className="text-xs text-emerald-400">En vivo · {user}</p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm
                     transition hover:border-slate-500 hover:bg-slate-800"
        >
          Salir
        </button>
      </header>

      <MessageList messages={FAKE_MESSAGES} currentUser={user} />

      <ChatInput onSend={(text) => console.log("enviar:", text)} disabled={false} />
    </div>
  );
}
```

- [ ] **Step 7: Verificar visualmente**

Run: `cd client && npm run dev`

Comprobar en `http://localhost:5173`:
- Los botones de partido están **apagados** hasta escribir un nombre, y aparece "Elegí un nombre para entrar".
- Al escribir un nombre se encienden.
- Al entrar se ve el header con el partido correcto, los tres mensajes falsos (el de "Martina" a la derecha si ese es el nombre que pusiste, la reacción con el emoji grande) y el input abajo.
- "Salir" vuelve al Home.
- Achicando la ventana a ancho de celular, nada se desborda horizontalmente y el input sigue visible.

Cortar con Ctrl+C.

- [ ] **Step 8: Verificar los tipos**

Run: `cd client && npx tsc -b --noEmit`
Expected: sin errores. Si aparece TS6059, falta el `rootDir: ".."` de la Tarea 2 Step 5.

- [ ] **Step 9: Commitear**

```bash
git add client/src
git commit -m "feat: maquetar Home y Room con Tailwind

Pantallas y componentes visuales con datos falsos, sin conexion real
todavia. El layout de la sala usa flex en columna para que la zona de
scroll sea el espacio sobrante y el input quede siempre visible."
```

- [ ] **Step 10: Integrar por Pull Request**

```bash
git push -u origin feat/frontend-layout
gh pr create --base main --title "feat: maquetado de Home y Room" \
  --body "Pantallas con Tailwind y datos falsos. La conexion real va en el PR siguiente."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Tarea 7: La conexión real (`useRoomSocket`)

Es el criterio 1 de la evaluación, el de más peso.

**Files:**
- Create: `client/src/hooks/useRoomSocket.ts`
- Modify: `client/src/screens/Room.tsx` (quitar los datos falsos y cablear el hook)

**Interfaces:**
- Consumes: `ClientEvent`, `Message`, `RoomId`, `ServerEvent` de `shared/types`
- Produces: `useRoomSocket(roomId: RoomId, user: string)` que devuelve
  `{ messages: Message[]; status: Status; error: string | null; send: (event: ClientEvent) => void }`
  con `type Status = "connecting" | "open" | "closed" | "error"`

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b feat/websocket-client
```

- [ ] **Step 2: Crear `client/src/hooks/useRoomSocket.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientEvent, Message, RoomId, ServerEvent } from "../../../shared/types";

export type Status = "connecting" | "open" | "closed" | "error";

const SERVER_URL = "ws://localhost:8080";

export function useRoomSocket(roomId: RoomId, user: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);

  // El socket va en un ref, no en estado: no se dibuja, asi que guardarlo en
  // estado provocaria re-renders inutiles. Y una variable local no sirve
  // porque se recrearia en cada render, perdiendo la conexion.
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(
      `${SERVER_URL}?room=${roomId}&user=${encodeURIComponent(user)}`,
    );
    socketRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");

    ws.onmessage = (raw) => {
      const event: ServerEvent = JSON.parse(raw.data);

      switch (event.type) {
        case "HISTORY":
          setMessages(event.messages);
          break;
        case "MESSAGE":
          // Forma funcional obligatoria: esta funcion se creo una sola vez y
          // capturo `messages` cuando valia []. Usar esa copia congelada
          // (stale closure) haria que el chat mostrara un solo mensaje.
          setMessages((prev) => [...prev, event.message]);
          break;
        case "ERROR":
          setError(event.reason);
          break;
        default: {
          const exhaustive: never = event;
          return exhaustive;
        }
      }
    };

    // Limpieza al desmontar: esto es lo que evita la fuga de memoria.
    // El close() de aca es el mismo evento que el ws.on("close") del servidor.
    return () => {
      ws.onmessage = null;

      if (ws.readyState === WebSocket.CONNECTING) {
        // StrictMode monta, desmonta y remonta en desarrollo. Cerrar un socket
        // que todavia negocia produce un warning; se espera al open para
        // cerrarlo ordenadamente.
        ws.onopen = () => ws.close(1000, "Salio de la sala");
      } else {
        ws.close(1000, "Salio de la sala");
      }

      socketRef.current = null;
    };
  }, [roomId, user]);

  const send = useCallback((event: ClientEvent) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      setError(null);
    }
  }, []);

  return { messages, status, error, send };
}
```

- [ ] **Step 3: Cablear el hook en `client/src/screens/Room.tsx`**

Reemplazar el archivo completo (desaparecen `FAKE_MESSAGES`):

```tsx
import { MATCHES, type RoomId } from "../../../shared/types";
import { useRoomSocket, type Status } from "../hooks/useRoomSocket";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";

type Props = { roomId: RoomId; user: string; onLeave: () => void };

const STATUS_LABEL: Record<Status, string> = {
  connecting: "Conectando…",
  open: "En vivo",
  closed: "Se perdió la conexión",
  error: "Error de conexión",
};

const STATUS_COLOR: Record<Status, string> = {
  connecting: "text-amber-400",
  open: "text-emerald-400",
  closed: "text-slate-500",
  error: "text-red-400",
};

export default function Room({ roomId, user, onLeave }: Props) {
  const { messages, status, error, send } = useRoomSocket(roomId, user);
  const match = MATCHES.find((item) => item.id === roomId);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="font-semibold">Sala en vivo: {match ? match.label : roomId}</h1>
          <p className={`text-xs ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]} · {user}
          </p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm
                     transition hover:border-slate-500 hover:bg-slate-800"
        >
          Salir
        </button>
      </header>

      <MessageList messages={messages} currentUser={user} />

      {error && (
        <p className="px-4 pb-2 text-sm text-red-400">{error}</p>
      )}

      <ChatInput
        onSend={(text) => send({ type: "CHAT", text })}
        disabled={status !== "open"}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verificar los tipos**

Run: `cd client && npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificar el aislamiento en el navegador**

Run (terminal 1): `cd server && npm run dev`
Run (terminal 2): `cd client && npm run dev`

Con dos pestañas en `http://localhost:5173`:

| Prueba | Resultado esperado |
|---|---|
| Ambas en Boca vs. River, escribir en una | Aparece al instante en las dos |
| Una en cada sala, escribir en Boca | **No** aparece en Argentina vs. Brasil |
| Entrar tarde a una sala con mensajes | Llega el historial |
| Salir al Home y volver a entrar | Se ve el historial, cada mensaje **una sola vez** |
| Entrar y salir cinco veces | La terminal del servidor termina en `(0 conectados)` |
| Cerrar una pestaña de golpe | Igual: el contador baja |
| Recargar dentro de una sala | Vuelve al Home |

La prueba de entrar y salir cinco veces es la que delata una limpieza mal hecha: si los mensajes empiezan a duplicarse o el contador no baja, el problema está en la función que devuelve el `useEffect`.

- [ ] **Step 6: Verificar que la consola del navegador está limpia**

Abrir DevTools → Console.
Expected: sin el warning *"WebSocket is closed before the connection is established"*. Si aparece, falta el chequeo de `WebSocket.CONNECTING` en la limpieza. **No desactivar `StrictMode` para silenciarlo.**

Cortar ambos servidores.

- [ ] **Step 7: Commitear**

```bash
git add client/src/hooks/useRoomSocket.ts client/src/screens/Room.tsx
git commit -m "feat: conectar la sala al servidor por WebSocket

Toda la logica del socket vive en useRoomSocket: la instancia en un ref
para no provocar re-renders, actualizaciones funcionales del estado para
evitar stale closures en el listener, y cierre de la conexion en la
limpieza del useEffect al desmontar la sala."
```

- [ ] **Step 8: Integrar por Pull Request**

```bash
git push -u origin feat/websocket-client
gh pr create --base main --title "feat: conexion WebSocket en el cliente" \
  --body "Hook useRoomSocket con manejo completo del ciclo de vida y desconexion limpia al desmontar."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Tarea 8: Reacciones rápidas

**Files:**
- Create: `client/src/components/ReactionBar.tsx`
- Modify: `client/src/screens/Room.tsx` (insertar la barra sobre el input)

**Interfaces:**
- Consumes: `REACTIONS`, `ReactionId` de `shared/types`; `send` de `useRoomSocket`
- Produces: `<ReactionBar onReact={(id: ReactionId) => void} disabled={boolean} />`

El servidor ya acepta el evento `REACTION` desde la Tarea 5 y `MessageList` ya sabe dibujarlo desde la Tarea 6: esta tarea es solo la interfaz que lo dispara.

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b feat/reactions
```

- [ ] **Step 2: Crear `client/src/components/ReactionBar.tsx`**

```tsx
import { REACTIONS, type ReactionId } from "../../../shared/types";

type Props = { onReact: (reactionId: ReactionId) => void; disabled: boolean };

export default function ReactionBar({ onReact, disabled }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1">
      {REACTIONS.map((reaction) => (
        <button
          key={reaction.id}
          type="button"
          disabled={disabled}
          onClick={() => onReact(reaction.id)}
          title={reaction.label}
          className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-4 py-2
                     text-sm transition hover:border-amber-500 hover:bg-slate-800
                     disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="text-lg">{reaction.emoji}</span>
          <span className="ml-2 text-slate-300">{reaction.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Insertar la barra en `Room.tsx`**

En `client/src/screens/Room.tsx`, agregar el import:

```tsx
import ReactionBar from "../components/ReactionBar";
```

y reemplazar el bloque que va desde `{error && (` hasta el cierre de `<ChatInput ... />` por:

```tsx
      {error && (
        <p className="px-4 pb-2 text-sm text-red-400">{error}</p>
      )}

      <ReactionBar
        onReact={(reactionId) => send({ type: "REACTION", reactionId })}
        disabled={status !== "open"}
      />

      <ChatInput
        onSend={(text) => send({ type: "CHAT", text })}
        disabled={status !== "open"}
      />
```

- [ ] **Step 4: Verificar los tipos**

Run: `cd client && npx tsc -b --noEmit`
Expected: sin errores.

- [ ] **Step 5: Verificar en el navegador**

Con servidor y cliente levantados y dos pestañas en la misma sala:
- Los cinco botones de reacción se ven sobre el input.
- Al tocar uno, la reacción aparece en **ambas** pestañas, con el emoji grande y en un estilo distinto del de los mensajes de texto.
- En una ventana angosta, la fila de reacciones scrollea horizontalmente sin desbordar la página.
- Con una pestaña en cada sala, una reacción en Boca **no** aparece en Argentina.
- Al salir y volver a entrar, las reacciones siguen en el historial.

- [ ] **Step 6: Commitear**

```bash
git add client/src/components/ReactionBar.tsx client/src/screens/Room.tsx
git commit -m "feat: agregar reacciones rapidas a la sala

Botones de mensajes predefinidos para que el usuario no tenga que
despegar la vista del partido para participar. El cliente envia solo el
identificador de la reaccion y el servidor lo valida contra la lista
compartida."
```

- [ ] **Step 7: Integrar por Pull Request**

```bash
git push -u origin feat/reactions
gh pr create --base main --title "feat: reacciones rapidas" \
  --body "Barra de mensajes predefinidos. El cliente manda el id de la reaccion, nunca texto libre."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

---

## Tarea 9: README y verificación final

**Files:**
- Modify: `README.md` (reemplazo completo)

**Interfaces:**
- Consumes: todo lo construido
- Produces: el segundo entregable del challenge

- [ ] **Step 1: Crear la rama**

```bash
git checkout main && git checkout -b docs/readme
```

- [ ] **Step 2: Sacar la captura de pantalla**

Levantar servidor y cliente, abrir dos ventanas lado a lado en la misma sala con algunos mensajes y una reacción, y capturar. Guardar como `docs/captura.png`.

- [ ] **Step 3: Escribir el `README.md`**

Reemplazar el archivo completo. Estructura obligatoria (los puntos 4 y 5 los exige la consigna):

````markdown
# WatchParty — Salas de chat en vivo por partido

Challenge técnico de onboarding. Aplicación web donde el usuario elige entre dos
partidos y entra a una sala de chat en tiempo real cuyos mensajes llegan
únicamente a quienes están en esa misma sala.

![Captura de la aplicación](docs/captura.png)

## Stack

- **Cliente:** React + Vite + TypeScript + Tailwind CSS v4
- **Servidor:** Node.js + Express + TypeScript (ejecutado con `tsx`)
- **Tiempo real:** WebSockets nativos con la librería `ws`
- **Tests:** Vitest

### Por qué `ws` nativo y no `socket.io`

`socket.io` resuelve las salas por dentro con `socket.join()` e `io.to().emit()`.
Justamente eso —el ruteo de salas y el broadcast filtrado— es el núcleo del
ejercicio, así que se escribió a mano para que la lógica sea explícita y
verificable. Las funciones que `socket.io` habría aportado de regalo
(reconexión automática, heartbeats) no están entre los requerimientos.

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
cd server && npm test        # tests del registro de salas y del contrato
cd server && npm run typecheck
cd client && npx tsc -b --noEmit
```

## Cómo está estructurada la separación de salas en el backend

El servidor mantiene un `Map<RoomId, Room>` creado **al arrancar**, con una
entrada por partido. Cada sala guarda dos cosas: un `Set` con las conexiones
presentes y un array con los últimos 50 mensajes.

```ts
type Room = { clients: Set<Client>; history: Message[] };
const rooms = new Map<RoomId, Room>(/* una por cada partido */);
```

La sala viaja en el **handshake** (`ws://localhost:8080?room=boca-river&user=Martina`),
no en un mensaje posterior. Así toda conexión nace perteneciendo a una sala
válida o es rechazada en el acto, sin un estado intermedio donde una conexión
abierta no pertenezca a ninguna sala.

El broadcast recorre únicamente el `Set` de su propia sala:

```ts
const data = JSON.stringify(event);
for (const client of room.clients) {
  if (client.readyState === OPEN) client.send(data);
}
```

**El aislamiento no es un filtro que se aplica al enviar: es consecuencia de
dónde se guardan las conexiones.** Las conexiones de la otra sala están en otro
`Set`, en otra entrada del `Map`, y este código no tiene forma de alcanzarlas.
No hay ningún `if (client.room === roomId)` que se pueda olvidar o escribir mal.

Además, el servidor nunca cree en la identidad que declara el cliente: el
cliente envía solo el contenido, y el autor, el id y el timestamp los asigna el
servidor a partir del nombre registrado en el handshake.

Está cubierto por tests en `server/src/rooms.test.ts`, entre ellos
*"un mensaje de boca-river no llega a los clientes de argentina-brasil"*.

## Cómo se limpian las conexiones al desmontar el componente

Toda la lógica del WebSocket vive en `client/src/hooks/useRoomSocket.ts`. El
`useEffect` que abre la conexión devuelve una función de limpieza que React
ejecuta al desmontar la sala:

```ts
return () => {
  ws.onmessage = null;
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close(1000, "Salio de la sala");
  } else {
    ws.close(1000, "Salio de la sala");
  }
  socketRef.current = null;
};
```

Al tocar "Salir", `App` pone la sesión en `null`, `Room` se desmonta y corre esa
limpieza. **El `close()` del cliente es el mismo evento que el `ws.on("close")`
del servidor**, que saca la conexión del `Set` de la sala: las dos limpiezas son
las dos puntas del mismo cierre.

Sin ella, el socket seguiría abierto llamando a `setMessages` sobre un
componente que ya no existe, el servidor le seguiría enviando mensajes a nadie,
y entrar y salir cinco veces dejaría cinco conexiones vivas — con lo cual cada
mensaje aparecería cinco veces al volver a entrar.

Dos detalles del hook que hacen que esto funcione de verdad:

- **La instancia va en un `useRef`**, no en `useState`: el socket no se dibuja,
  así que guardarlo en estado provocaría re-renders inútiles; y una variable
  local se recrearía en cada render, perdiendo la conexión.
- **El chequeo de `CONNECTING`** existe porque `StrictMode` monta, desmonta y
  vuelve a montar cada componente en desarrollo, justamente para delatar
  limpiezas mal hechas. Cerrar un socket que todavía negocia produce un warning;
  esperar al `open` lo evita sin desactivar `StrictMode`.

El servidor loguea el conteo por sala en cada entrada y salida, así que la
limpieza se puede verificar mirando la terminal:

```
[boca-river] + Martina (2 conectados)
[boca-river] - Martina (1 conectados)
```

## Integridad de tipos

`shared/types.ts` es el único lugar donde está definido qué puede viajar por el
socket, y lo importan cliente y servidor por igual: una sola fuente de verdad.

Los eventos son uniones discriminadas (`ClientEvent`, `ServerEvent`) y los
mensajes distinguen texto de reacción por el campo `kind`. No se usa `any` en
ninguna parte.

Como los tipos desaparecen al compilar y `JSON.parse` devuelve datos sin tipar,
el borde se valida a mano en `parseClientEvent(raw: unknown)`, que reconstruye
el evento campo por campo: lo que no está en el contrato nunca entra al sistema.

## Extra: reacciones rápidas

Además del input de texto que pide la consigna, la sala tiene una fila de
mensajes predefinidos (⚽ ¡GOL!, 👏 Vamos, 😱 No lo puedo creer…). La razón es de
producto: en una watch party el usuario está mirando el partido, y escribir
obliga a despegar la vista de la pantalla.

El cliente envía solo el identificador de la reacción, nunca su texto, y el
servidor lo valida contra la lista compartida. Así no se pueden inventar
reacciones editando el JSON desde la consola del navegador.

## Decisiones y limitaciones conscientes

- **Historial en memoria, últimos 50 por sala.** Se pierde al reiniciar el
  servidor. No hay base de datos porque no está en el alcance.
- **Sin heartbeat (ping/pong).** Si un cliente desaparece sin cierre limpio
  (por ejemplo, un corte de red), puede tardar en salir del registro. La
  solución estándar sería que el servidor mande un ping periódico y desconecte
  a quien no responda.
- **Sin reconexión automática.** Si se cae la conexión se muestra el estado y el
  usuario puede volver al Home.
- **Sin persistencia ni autenticación.** El nombre es libre y no se valida.
- **Navegación por estado, sin router.** Recargar dentro de una sala devuelve al
  Home, que es el comportamiento esperado: el nombre vive en memoria.
- **"Mensaje propio" se determina por nombre.** Si dos personas eligen el mismo
  nombre, ambas verán los mensajes de la otra como propios. Resolverlo bien
  requeriría un id de cliente asignado por el servidor.
````

- [ ] **Step 4: Correr la verificación final completa**

```bash
cd server && npm test && npm run typecheck && cd ..
cd client && npx tsc -b --noEmit && cd ..
```
Expected: 22 tests PASS, cero errores de tipos en ambos proyectos.

```bash
grep -rn ": any\|<any>\|as any" client/src server/src shared
```
Expected: sin resultados.

```bash
git status --short
```
Expected: solo los archivos del README y la captura. Si aparecen `.DS_Store`, `node_modules`, `.idea/` o `server/verify-isolation.mjs`, revisar el `.gitignore`.

- [ ] **Step 5: Repasar la tabla de verificación manual del diseño**

Recorrer las 11 pruebas de la sección 9 del spec
(`docs/superpowers/specs/2026-08-20-watchparty-chat-rooms-design.md`) con
servidor y cliente levantados. Las pruebas 4, 5 y 6 (salir y volver, entrar y
salir cinco veces, cerrar la pestaña de golpe) son las que detectan una limpieza
mal hecha y no se pueden saltear.

- [ ] **Step 6: Commitear**

```bash
git add README.md docs/captura.png
git commit -m "docs: escribir README con instrucciones y decisiones de diseño

Incluye los dos puntos que exige la consigna: como se estructura la
separacion de salas en el backend y como se limpian las conexiones en el
cliente al desmontar el componente."
```

- [ ] **Step 7: Integrar por Pull Request**

```bash
git push -u origin docs/readme
gh pr create --base main --title "docs: README de entrega" \
  --body "Instrucciones de ejecucion, explicacion de la separacion de salas y de la limpieza de conexiones, y limitaciones conscientes."
gh pr merge --merge --delete-branch
git checkout main && git pull
```

- [ ] **Step 8: Revisar el historial de Git antes de entregar**

Run: `git log --oneline --graph -25`
Expected: se ven los merges de las siete ramas de feature, cada una con sus
commits chicos y mensajes claros. Este es el criterio 4 de la evaluación y es lo
que el Tech Lead va a mirar primero al abrir el repositorio.

Run: `gh pr list --state merged`
Expected: siete Pull Requests mergeados.

---

## Verificación de cobertura del spec

| Sección del spec | Tarea que la implementa |
|---|---|
| 3. Estructura del repositorio | Tarea 2 |
| 4. Flujo de datos punta a punta | Tareas 5 y 7 |
| 5. Contrato de tipos | Tarea 3 |
| 6. Backend: registro y broadcast | Tarea 4 |
| 6. Backend: ciclo de vida de la conexión y logs | Tarea 5 |
| 7. Frontend: App, Home, componentes | Tarea 6 |
| 7. Frontend: `useRoomSocket` | Tarea 7 |
| 7. Frontend: reacciones | Tarea 8 |
| 8. Tests | Tareas 3 y 4 |
| 9. Verificación manual | Tareas 7 y 9 |
| 10. Flujo de Git | Todas (una rama y un PR por tarea) |
| 11. README | Tarea 9 |
