import { MATCHES, type Message, type RoomId } from "../../../shared/types";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";

type Props = { roomId: RoomId; user: string; onLeave: () => void };

// Datos falsos: en la tarea 7 los reemplaza el hook del WebSocket.
const FAKE_MESSAGES: Message[] = [
  { id: "1", roomId: "boca-river", user: "Fan_101", timestamp: Date.now() - 60000,
    kind: "text", text: "Arranca el partido" },
  { id: "2", roomId: "boca-river", user: "Fan_202", timestamp: Date.now() - 30000,
    kind: "reaction", reactionId: "gol" },
  { id: "3", roomId: "boca-river", user: "Martina", timestamp: Date.now(),
    kind: "text", text: "No lo puedo creer" },
];

export default function Room({ roomId, user, onLeave }: Props) {
  const match = MATCHES.find((item) => item.id === roomId);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="font-semibold">Sala en vivo: {match ? match.label : roomId}</h1>
          <p className="text-xs text-emerald-400">En vivo · {user}</p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="rounded-full border border-slate-700 px-4 py-2 text-sm
                     transition hover:border-slate-500 hover:bg-slate-800"
        >
          Salir
        </button>
      </header>

      <MessageList messages={FAKE_MESSAGES} currentUser={user} />

      <ChatInput onSend={(text) => console.log("enviar:", text)} disabled={false} />
    </div>
  );
}
