import { useState } from "react";
import type { RoomId } from "../../shared/types";
import Home from "./screens/Home";
import Room from "./screens/Room";
import { readStoredUser, writeStoredUser } from "./storage";

export default function App() {
  // El nombre vive aca, no dentro de Home: Home se desmonta al entrar a una
  // sala, y un componente desmontado no conserva su estado. Subirlo es lo que
  // hace que no haya que volver a escribirlo al salir.
  // El inicializador es perezoso: lee el almacenamiento una sola vez, al
  // arrancar, en vez de en cada render.
  const [name, setName] = useState<string>(readStoredUser);
  const [roomId, setRoomId] = useState<RoomId | null>(null);

  const user = name.trim();

  function handleNameChange(value: string) {
    setName(value);
    // Se guarda mientras se escribe, no al entrar a la sala: asi el nombre
    // queda registrado aunque cierres la pestaña sin llegar a jugar.
    writeStoredUser(value);
  }

  // Poner la sala en null desmonta Room, y desmontar Room es lo que dispara la
  // limpieza del WebSocket. El nombre no se toca: sobrevive a la salida.
  return roomId ? (
    <Room roomId={roomId} user={user} onLeave={() => setRoomId(null)} />
  ) : (
    <Home name={name} onNameChange={handleNameChange} onJoin={setRoomId} />
  );
}
