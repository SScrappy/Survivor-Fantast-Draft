"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDraftOrder, randomizeDraftOrder } from "@/lib/actions/leagues";

interface MemberRow {
  id: string;
  displayName: string;
  draftPosition: number | null;
}

export default function DraftOrderEditor({
  leagueId,
  members,
}: {
  leagueId: string;
  members: MemberRow[];
}) {
  const router = useRouter();
  const [positions, setPositions] = useState<Record<string, number | null>>(
    Object.fromEntries(members.map((m) => [m.id, m.draftPosition]))
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const positionOptions = members.map((_, i) => i + 1);
  const usedPositions = new Set(Object.values(positions).filter((p): p is number => p !== null));
  const isComplete = usedPositions.size === members.length;

  function save() {
    setError(null);
    const assignments = Object.entries(positions)
      .filter(([, pos]) => pos !== null)
      .map(([member_id, pos]) => ({ member_id, position: pos as number }));

    startTransition(async () => {
      const result = await setDraftOrder(leagueId, assignments);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function randomize() {
    setError(null);
    startTransition(async () => {
      await randomizeDraftOrder(leagueId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-2.5">
            <span>{m.displayName}</span>
            <select
              value={positions[m.id] ?? ""}
              onChange={(e) =>
                setPositions((prev) => ({
                  ...prev,
                  [m.id]: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="border border-neutral-300 rounded-md px-2 py-1 text-sm"
            >
              <option value="">—</option>
              {positionOptions.map((p) => (
                <option key={p} value={p}>
                  Pick #{p}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          onClick={randomize}
          disabled={pending}
          className="border border-neutral-300 rounded-md px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
        >
          Randomize order
        </button>
        <button
          onClick={save}
          disabled={pending || !isComplete}
          className="bg-neutral-900 text-white rounded-md px-3 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
        >
          Save draft order
        </button>
      </div>
      {!isComplete && (
        <p className="text-xs text-neutral-500">
          Assign every drafter a unique pick number before saving.
        </p>
      )}
    </div>
  );
}
