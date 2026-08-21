import { describe, it, expect } from "vitest";
import { isRoomId, isReactionId, parseClientEvent, parseServerEvent } from "../../shared/types";

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

describe("parseServerEvent", () => {
  const mensaje = {
    id: "1",
    roomId: "boca-river",
    user: "Martina",
    timestamp: 1000,
    kind: "text",
    text: "vamos",
  };

  it("acepta un HISTORY con lista de mensajes", () => {
    expect(parseServerEvent({ type: "HISTORY", messages: [mensaje] }))
      .toEqual({ type: "HISTORY", messages: [mensaje] });
  });

  it("rechaza un HISTORY cuyo messages no es array", () => {
    expect(parseServerEvent({ type: "HISTORY", messages: "no-array" })).toBeNull();
  });

  it("acepta un MESSAGE con mensaje", () => {
    expect(parseServerEvent({ type: "MESSAGE", message: mensaje }))
      .toEqual({ type: "MESSAGE", message: mensaje });
  });

  it("rechaza un MESSAGE sin message", () => {
    expect(parseServerEvent({ type: "MESSAGE" })).toBeNull();
  });

  it("acepta un ERROR con reason", () => {
    expect(parseServerEvent({ type: "ERROR", reason: "sala invalida" }))
      .toEqual({ type: "ERROR", reason: "sala invalida" });
  });

  it("rechaza un ERROR cuyo reason no es string", () => {
    expect(parseServerEvent({ type: "ERROR", reason: 404 })).toBeNull();
  });

  it("rechaza un tipo desconocido", () => {
    expect(parseServerEvent({ type: "PING" })).toBeNull();
  });

  it("rechaza valores que no son objetos", () => {
    expect(parseServerEvent(null)).toBeNull();
    expect(parseServerEvent("HISTORY")).toBeNull();
    expect(parseServerEvent(undefined)).toBeNull();
  });
});
