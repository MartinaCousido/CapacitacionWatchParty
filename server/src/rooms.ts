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
