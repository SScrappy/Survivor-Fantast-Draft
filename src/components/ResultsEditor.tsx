"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlayerPlacement } from "@/lib/actions/leagues";

interface PlayerRow {
  id: string;
  name: string;
  placement: number | null;
}

export default function ResultsEditor({
  leagueId,
  players,
}: {
  leagueId: string;
  players: PlayerRow[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const poolSize = players.length;

  function update(playerId: string, value: string) {
    setError(null);
    setPendingId(playerId);
    const placement = value ? Number(value) : null;

    startTransition(async () => {
      const result = await setPlayerPlacement(leagueId, playerId, placement);
      if (result.error) setError(result.error);
      setPendingId(null);
      router.refresh();
    });
  }

  const sorted = [...players].sort((a, b) => {
    if (a.placement === null && b.placement === null) return a.name.localeCompare(b.name);
    if (a.placement === null) return 1;
    if (b.placement === null) return -1;
    return b.placement - a.placement;
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        1 point for the first boot, up to {poolSize} for the Sole Survivor. Applies to every
        league drafting this season.
      </p>
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white">
        {sorted.map((player) => (
          <li key={player.id} className="flex items-center justify-between px-4 py-2.5">
            <span>{player.name}</span>
            <select
              value={player.placement ?? ""}
              disabled={pendingId === player.id}
              onChange={(e) => update(player.id, e.target.value)}
              className="border border-neutral-300 rounded-md px-2 py-1 text-sm disabled:opacity-50"
            >
              <option value="">—</option>
              {Array.from({ length: poolSize }, (_, i) => poolSize - i).map((p) => (
                <option key={p} value={p}>
                  {p} pt{p === 1 ? "" : "s"}
                  {p === poolSize ? " (Sole Survivor)" : ""}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
