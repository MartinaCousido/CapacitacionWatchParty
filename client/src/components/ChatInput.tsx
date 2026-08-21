import { useState, type FormEvent } from "react";
import { MAX_TEXT_LENGTH } from "../../../shared/types";

type Props = { onSend: (text: string) => void; disabled: boolean };

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (value.length === 0) return;
    onSend(value);
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 px-4 pb-4">
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={MAX_TEXT_LENGTH}
        disabled={disabled}
        placeholder="Escribí un comentario…"
        className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-3
                   text-slate-100 placeholder:text-slate-600
                   focus:border-emerald-500 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        className="rounded-full bg-emerald-600 px-6 py-3 font-semibold text-white
                   transition hover:bg-emerald-500
                   disabled:cursor-not-allowed disabled:opacity-40"
      >
        Enviar
      </button>
    </form>
  );
}
