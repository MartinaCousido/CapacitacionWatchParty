import { MATCHES, type RoomId } from "../../../shared/types";
import { useRoomSocket, type Status } from "../hooks/useRoomSocket";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import ReactionBar from "../components/ReactionBar";

type Props = { roomId: RoomId; user: string; onLeave: () => void };

const STATUS_LABEL: Record<Status, string> = {
  connecting: "Conectando…",
  open: "En vivo",
  closed: "Se perdió la conexión",
  error: "Error de conexión",
};

const STATUS_COLOR: Record<Status, string> = {
  connecting: "text-amber-400",
  open: "text-emerald-400",
  closed: "text-slate-500",
  error: "text-red-400",
};

export default function Room({ roomId, user, onLeave }: Props) {
  const { messages, status, error, send } = useRoomSocket(roomId, user);
  const match = MATCHES.find((item) => item.id === roomId);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="font-semibold">Sala en vivo: {match ? match.label : roomId}</h1>
          <p className={`text-xs ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]} · {user}
          </p>
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

      <MessageList messages={messages} currentUser={user} />

      {error && (
        <p className="px-4 pb-2 text-sm text-red-400">{error}</p>
      )}

      <ReactionBar
        onReact={(reactionId) => send({ type: "REACTION", reactionId })}
        disabled={status !== "open"}
      />

      <ChatInput
        onSend={(text) => send({ type: "CHAT", text })}
        disabled={status !== "open"}
      />
    </div>
  );
}
