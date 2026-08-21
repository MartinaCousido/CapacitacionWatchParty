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
