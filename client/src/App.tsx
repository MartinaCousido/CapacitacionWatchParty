import { useState } from "react";
import type { RoomId } from "../../shared/types";
import Home from "./screens/Home";
import Room from "./screens/Room";

export type Session = { roomId: RoomId; user: string };

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  // Poner la sesion en null desmonta Room, y desmontar Room es lo que
  // dispara la limpieza del WebSocket.
  return session ? (
    <Room roomId={session.roomId} user={session.user} onLeave={() => setSession(null)} />
  ) : (
    <Home onJoin={setSession} />
  );
}
