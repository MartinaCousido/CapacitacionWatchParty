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
