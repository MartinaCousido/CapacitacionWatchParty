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

/**
 * Frontera del sistema, sentido servidor -> cliente: lo que llega por el
 * socket es JSON sin tipar. Se valida la forma del sobre (el `type` y la
 * presencia/tipo basico de cada campo), no el contenido de cada `Message`
 * dentro de `messages`/`message`: esos objetos los arma el servidor con
 * datos que ya pasaron por su propio borde validado (`parseClientEvent` +
 * el estado de `rooms.ts`), asi que alcanza con confirmar que el sobre no
 * llegó corrompido.
 */
export function parseServerEvent(raw: unknown): ServerEvent | null {
  if (typeof raw !== "object" || raw === null) return null;

  const candidate = raw as Record<string, unknown>;

  if (candidate.type === "HISTORY") {
    return Array.isArray(candidate.messages)
      ? { type: "HISTORY", messages: candidate.messages as Message[] }
      : null;
  }

  if (candidate.type === "MESSAGE") {
    return typeof candidate.message === "object" && candidate.message !== null
      ? { type: "MESSAGE", message: candidate.message as Message }
      : null;
  }

  if (candidate.type === "ERROR") {
    return typeof candidate.reason === "string"
      ? { type: "ERROR", reason: candidate.reason }
      : null;
  }

  return null;
}
