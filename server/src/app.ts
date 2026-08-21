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
  type ServerEvent,
} from "../../shared/types";
import { addToHistory, broadcast, countClients, getHistory, join, leave } from "./rooms";

/**
 * Tamaño máximo de un frame entrante. Sin esto, `ws` acepta hasta 100MB por
 * defecto y ese contenido se convierte a string y se parsea ANTES de que
 * MAX_TEXT_LENGTH pueda recortarlo: un cliente podría agotar la memoria del
 * servidor sin llegar a mandar un mensaje válido.
 */
const MAX_PAYLOAD_BYTES = 16 * 1024;

type Options = {
  /** Los tests lo apagan para que la salida de la suite quede limpia. */
  log?: boolean;
};

/**
 * Arma el servidor HTTP con Express y el WebSocket encima, pero NO lo pone a
 * escuchar: de eso se encarga `index.ts` en producción y el test en un puerto
 * efímero. Separarlo es lo que hace testeable el ciclo de vida de la conexión.
 */
export function createServer({ log = true }: Options = {}): http.Server {
  const app = express();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Express y el WebSocket comparten servidor HTTP y puerto: un WebSocket empieza
  // como una peticion HTTP que pide convertirse (upgrade), y WebSocketServer se
  // engancha a esas peticiones dejando el resto a Express.
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, maxPayload: MAX_PAYLOAD_BYTES });

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
    if (log) console.log(`[${room}] + ${user} (${countClients(room)} conectados)`);

    const history: ServerEvent = { type: "HISTORY", messages: getHistory(room) };
    ws.send(JSON.stringify(history));

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
        const error: ServerEvent = { type: "ERROR", reason: "Mensaje invalido" };
        ws.send(JSON.stringify(error));
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
      if (log) console.log(`[${room}] - ${user} (${countClients(room)} conectados)`);
    };

    ws.on("close", disconnect);
    ws.on("error", disconnect);
  });

  return server;
}
