import { useEffect, useRef } from "react";
import { REACTIONS, type Message } from "../../../shared/types";

type Props = { messages: Message[]; currentUser: string };

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageList({ messages, currentUser }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-600">
        Todavía no dijo nada nadie. Empezá vos.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((message) => {
        // "Propio" se decide por nombre. Si dos personas eligen el mismo,
        // ambas se ven reflejadas: limitacion aceptada en el diseño.
        const isOwn = message.user === currentUser;
        const reaction =
          message.kind === "reaction"
            ? REACTIONS.find((item) => item.id === message.reactionId)
            : undefined;

        return (
          <div key={message.id} className={isOwn ? "flex justify-end" : "flex justify-start"}>
            <div className="max-w-[75%]">
              <div className="mb-1 flex items-baseline gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-400">{message.user}</span>
                <span>{formatTime(message.timestamp)}</span>
              </div>

              {message.kind === "text" ? (
                <p
                  className={`rounded-2xl px-4 py-2 ${
                    isOwn ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-100"
                  }`}
                >
                  {message.text}
                </p>
              ) : (
                <p className="rounded-2xl bg-slate-900 border border-slate-700 px-4 py-2 text-2xl">
                  <span>{reaction ? reaction.emoji : "❓"}</span>
                  <span className="ml-2 align-middle text-base font-semibold text-amber-300">
                    {reaction ? reaction.label : message.reactionId}
                  </span>
                </p>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
