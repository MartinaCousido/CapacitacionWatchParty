import { REACTIONS, type ReactionId } from "../../../shared/types";

type Props = { onReact: (reactionId: ReactionId) => void; disabled: boolean };

export default function ReactionBar({ onReact, disabled }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1">
      {REACTIONS.map((reaction) => (
        <button
          key={reaction.id}
          type="button"
          disabled={disabled}
          onClick={() => onReact(reaction.id)}
          title={reaction.label}
          className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-4 py-2
                     text-sm transition hover:border-amber-500 hover:bg-slate-800
                     disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="text-lg">{reaction.emoji}</span>
          <span className="ml-2 text-slate-300">{reaction.label}</span>
        </button>
      ))}
    </div>
  );
}
