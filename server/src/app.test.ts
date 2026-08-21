import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import WebSocket from "ws";
import { createServer } from "./app";
import { resetRooms } from "./rooms";
import type { ServerEvent } from "../../shared/types";

/**
 * Tests de integración del ciclo de vida de la conexión: levantan el servidor
 * de verdad en un puerto efímero y hablan con él usando clientes WebSocket
 * reales. Lo que `rooms.test.ts` prueba con objetos planos, acá se prueba
 * punta a punta, que es donde vive el requisito que la consigna marca en
 * negrita: un mensaje de una sala no puede aparecer en la otra.
 */

let server: http.Server;
let port: number;
let clients: WebSocket[] = [];

beforeEach(async () => {
  resetRooms();
  clients = [];
  server = createServer({ log: false });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterEach(async () => {
  // Los sockets vivos impiden que server.close() termine, así que se cortan primero.
  for (const ws of clients) ws.terminate();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

type Client = { ws: WebSocket; events: ServerEvent[] };

/** Conecta y resuelve cuando el handshake terminó, acumulando lo que reciba. */
function connect(room: string, user: string): Promise<Client> {
  const ws = new WebSocket(`ws://localhost:${port}?room=${room}&user=${encodeURIComponent(user)}`);
  clients.push(ws);

  const events: ServerEvent[] = [];
  ws.on("message", (raw) => events.push(JSON.parse(raw.toString()) as ServerEvent));

  return new Promise((resolve, reject) => {
    ws.on("open", () => resolve({ ws, events }));
    ws.on("error", reject);
  });
}

/** Espera a que aparezca un evento que cumpla el predicado, sin sleeps fijos. */
function waitFor(
  events: ServerEvent[],
  predicate: (event: ServerEvent) => boolean,
  timeoutMs = 2000,
): Promise<ServerEvent> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const found = events.find(predicate);
      if (found) return resolve(found);
      if (Date.now() - startedAt > timeoutMs) return reject(new Error("timeout esperando el evento"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

const isChat = (text: string) => (event: ServerEvent) =>
  event.type === "MESSAGE" && event.message.kind === "text" && event.message.text === text;

describe("aislamiento punta a punta", () => {
  it("un mensaje de boca-river llega a esa sala y NO a argentina-brasil", async () => {
    const bocaA = await connect("boca-river", "Martina");
    const bocaB = await connect("boca-river", "Test");
    const argentina = await connect("argentina-brasil", "Otro");

    bocaA.ws.send(JSON.stringify({ type: "CHAT", text: "dale Boca" }));

    // Ambos clientes de la sala lo reciben...
    await waitFor(bocaA.events, isChat("dale Boca"));
    await waitFor(bocaB.events, isChat("dale Boca"));

    // ...y el de la otra sala no recibió nada más que su HISTORY inicial.
    expect(argentina.events.filter((event) => event.type === "MESSAGE")).toHaveLength(0);
    expect(argentina.events.map((event) => event.type)).toEqual(["HISTORY"]);
  });

  it("el historial de una sala no incluye mensajes de la otra", async () => {
    const boca = await connect("boca-river", "Martina");
    boca.ws.send(JSON.stringify({ type: "CHAT", text: "solo Boca" }));
    await waitFor(boca.events, isChat("solo Boca"));

    // Alguien entra tarde a la OTRA sala: su historial tiene que venir vacío.
    const argentina = await connect("argentina-brasil", "Otro");
    const history = await waitFor(argentina.events, (event) => event.type === "HISTORY");

    expect(history.type === "HISTORY" && history.messages).toEqual([]);
  });
});

describe("handshake", () => {
  it("cierra con codigo 4004 si la sala no existe", async () => {
    const ws = new WebSocket(`ws://localhost:${port}?room=sala-pirata&user=X`);
    clients.push(ws);
    ws.on("error", () => {}); // evita un unhandled error si el cierre llega como error

    const code = await new Promise<number>((resolve) => ws.on("close", resolve));
    expect(code).toBe(4004);
  });

  it("cierra con codigo 4004 si el usuario viene vacio", async () => {
    const ws = new WebSocket(`ws://localhost:${port}?room=boca-river&user=`);
    clients.push(ws);
    ws.on("error", () => {});

    const code = await new Promise<number>((resolve) => ws.on("close", resolve));
    expect(code).toBe(4004);
  });
});

describe("identidad", () => {
  it("el autor lo asigna el servidor: un `user` en el payload no puede suplantar a nadie", async () => {
    const boca = await connect("boca-river", "Martina");

    // Un cliente malicioso agrega un campo que el contrato no contempla.
    boca.ws.send(JSON.stringify({ type: "CHAT", text: "firmado por otro", user: "impostor" }));

    const event = await waitFor(boca.events, isChat("firmado por otro"));
    expect(event.type === "MESSAGE" && event.message.user).toBe("Martina");
  });

  it("el servidor asigna id y timestamp, y la sala del mensaje es la del handshake", async () => {
    const boca = await connect("boca-river", "Martina");
    boca.ws.send(JSON.stringify({ type: "CHAT", text: "hola" }));

    const event = await waitFor(boca.events, isChat("hola"));
    if (event.type !== "MESSAGE") throw new Error("se esperaba un MESSAGE");

    expect(event.message.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.message.timestamp).toBeGreaterThan(0);
    expect(event.message.roomId).toBe("boca-river");
  });
});

describe("entradas invalidas", () => {
  it("un frame que no es JSON no tira el proceso: responde ERROR solo al que lo mando", async () => {
    const boca = await connect("boca-river", "Martina");
    const otro = await connect("boca-river", "Test");

    boca.ws.send("esto no es json");

    await waitFor(boca.events, (event) => event.type === "ERROR");
    expect(otro.events.filter((event) => event.type === "ERROR")).toHaveLength(0);
  });

  it("un mensaje vacio no se difunde", async () => {
    const boca = await connect("boca-river", "Martina");

    boca.ws.send(JSON.stringify({ type: "CHAT", text: "   " }));
    boca.ws.send(JSON.stringify({ type: "CHAT", text: "este si" }));

    // Si el vacio se hubiera difundido, llegaria antes que este.
    await waitFor(boca.events, isChat("este si"));
    expect(boca.events.filter((event) => event.type === "MESSAGE")).toHaveLength(1);
  });
});

describe("limpieza de conexiones", () => {
  it("al cerrarse un cliente, deja de recibir y la sala queda sin conexiones colgadas", async () => {
    const boca = await connect("boca-river", "Martina");
    const otro = await connect("boca-river", "Test");

    await new Promise<void>((resolve) => {
      otro.ws.on("close", () => resolve());
      otro.ws.close();
    });

    boca.ws.send(JSON.stringify({ type: "CHAT", text: "despues del cierre" }));
    await waitFor(boca.events, isChat("despues del cierre"));

    expect(otro.events.filter((event) => event.type === "MESSAGE")).toHaveLength(0);
  });
});
