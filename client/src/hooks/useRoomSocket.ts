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
