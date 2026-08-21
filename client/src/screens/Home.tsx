import { useState } from "react";
import { MATCHES, MAX_USER_LENGTH } from "../../../shared/types";
import type { Session } from "../App";

type Props = { onJoin: (session: Session) => void };

export default function Home({ onJoin }: Props) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const canJoin = trimmed.length > 0;

  return (
    <main className="min-h-full flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-center">WatchParty</h1>
        <p className="mt-2 text-center text-slate-400">
          Elegí un partido y sumate a la hinchada.
        </p>

        <label className="mt-8 block">
          <span className="text-sm font-medium text-slate-300">Tu nombre</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_USER_LENGTH}
            placeholder="Fan_123"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3
                       text-slate-100 placeholder:text-slate-600
                       focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <div className="mt-6 space-y-3">
          {MATCHES.map((match) => (
            <button
              key={match.id}
              type="button"
              disabled={!canJoin}
              onClick={() => onJoin({ roomId: match.id, user: trimmed })}
              className="w-full rounded-xl border border-slate-800 bg-gradient-to-r
                         from-slate-900 to-slate-800 px-5 py-4 text-left text-lg font-semibold
                         transition hover:border-emerald-600 hover:from-slate-800
                         disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-800"
            >
              {match.label}
              <span className="ml-2 text-sm font-normal text-emerald-400">· en vivo</span>
            </button>
          ))}
        </div>

        {!canJoin && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Elegí un nombre para entrar.
          </p>
        )}
      </div>
    </main>
  );
}
