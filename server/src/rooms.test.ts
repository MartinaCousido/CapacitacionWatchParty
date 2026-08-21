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
