import { useCallback, useEffect, useRef, useState } from "react";
import { parseServerEvent } from "../../../shared/types";
import type { ClientEvent, Message, RoomId, ServerEvent } from "../../../shared/types";

export type Status = "connecting" | "open" | "closed" | "error";

// El servidor lee `PORT` del entorno, asi que el cliente tiene que poder
// apuntar a otro lado sin recompilar.
// La anotacion `: string` no es decorativa: los tipos por defecto de Vite
// declaran import.meta.env como Record<string, any>, asi que sin esto
// SERVER_URL entraria al codigo como `any`.
const SERVER_URL: string = import.meta.env.VITE_WS_URL ?? "ws://localhost:8080";

export function useRoomSocket(roomId: RoomId, user: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);

  // El socket va en un ref, no en estado: no se dibuja, asi que guardarlo en
  // estado provocaria re-renders inutiles. Y una variable local no sirve
  // porque se recrearia en cada render, perdiendo la conexion.
  const socketRef = useRef<WebSocket | null>(null);

  // Distingue "nunca llego a abrir" (error real) de "abrio y despues se
  // cayo" (conexion perdida): ambos casos disparan onclose, asi que sin
  // este ref el estado "error" quedaria pisado siempre por "closed".
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    hasOpenedRef.current = false;

    const ws = new WebSocket(
      `${SERVER_URL}?room=${roomId}&user=${encodeURIComponent(user)}`,
    );
    socketRef.current = ws;
    // Resetea el estado al reconectar (cambio de sala o de usuario). La regla
    // apunta a los setState que podrian derivarse durante el render; aca no es
    // el caso: el estado depende de una conexion externa que recien se abre.
    // oxlint-disable-next-line react/set-state-in-effect
    setStatus("connecting");

    ws.onopen = () => {
      hasOpenedRef.current = true;
      setStatus("open");
    };
    ws.onclose = () => setStatus(hasOpenedRef.current ? "closed" : "error");
    ws.onerror = () => setStatus("error");

    ws.onmessage = (raw) => {
      // Borde no tipado: `raw.data` es JSON crudo. Se parsea y se valida con
      // parseServerEvent (nunca una aserion directa a ServerEvent), y un
      // frame corrompido o no-JSON se descarta en silencio en vez de tirar
      // dentro del handler.
      let event: ServerEvent | null = null;
      try {
        event = parseServerEvent(JSON.parse(String(raw.data)));
      } catch {
        event = null;
      }
      if (!event) return;

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
      // Los tres handlers se desenganchan, no solo onmessage: en StrictMode
      // el socket viejo (A) puede seguir vivo cuando ya se creo el nuevo (B).
      // Si A conserva su onclose/onerror, cuando A termine de cerrarse solo
      // pisaria el estado que ya reporto B (p. ej. "open" -> "closed"),
      // dejando la UI en un estado que no corresponde a la conexion real.
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;

      if (ws.readyState === WebSocket.CONNECTING) {
        // StrictMode monta, desmonta y remonta en desarrollo. Cerrar un socket
        // que todavia negocia produce un warning; se espera al open para
        // cerrarlo ordenadamente.
        ws.onopen = () => ws.close(1000, "Salio de la sala");
      } else {
        ws.onopen = null;
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
