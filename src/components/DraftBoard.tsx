"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { LeagueStatus, Pick, Player } from "@/types/database";

interface Member {
  id: string;
  profileId: string;
  displayName: string;
  draftPosition: number;
}

export default function DraftBoard({
  league,
  members,
  players,
  initialPicks,
  currentUserId,
}: {
  league: {
    id: string;
    status: LeagueStatus;
    numDrafters: number;
    numRounds: number;
    season: string;
    name: string;
  };
  members: Member[];
  players: Player[];
  initialPicks: Pick[];
  currentUserId: string;
}) {
  const [picks, setPicks] = useState<Pick[]>(initialPicks);
  const [status, setStatus] = useState<LeagueStatus>(league.status);
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // @supabase/ssr's cookie-backed browser client doesn't automatically push
    // the session JWT into the Realtime websocket connection the way the
    // plain supabase-js client does — without this, Realtime authorizes the
    // connection as `anon`, and RLS silently filters out every event. Setting
    // it explicitly before subscribing ensures the connection carries the
    // user's token so `is_league_member()` (and RLS generally) evaluates
    // correctly server-side.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`league-${league.id}-draft`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "picks", filter: `league_id=eq.${league.id}` },
          (payload) => {
            const newPick = payload.new as Pick;
            setPicks((prev) => (prev.some((p) => p.id === newPick.id) ? prev : [...prev, newPick]));
            setPendingPlayerId(null);
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "leagues", filter: `id=eq.${league.id}` },
          (payload) => {
            setStatus((payload.new as { status: LeagueStatus }).status);
          }
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [league.id]);

  const membersByPosition = useMemo(
    () => new Map(members.map((m) => [m.draftPosition, m])),
    [members]
  );
  const memberByProfileId = useMemo(
    () => new Map(members.map((m) => [m.profileId, m])),
    [members]
  );

  const totalPicks = league.numDrafters * league.numRounds;
  const picksMade = picks.length;
  const draftComplete = picksMade >= totalPicks || status === "complete";

  const round = Math.min(Math.floor(picksMade / league.numDrafters) + 1, league.numRounds);
  const posInRound = (picksMade % league.numDrafters) + 1;
  const expectedPosition = round % 2 === 1 ? posInRound : league.numDrafters - posInRound + 1;
  const currentMember = draftComplete ? null : membersByPosition.get(expectedPosition);
  const isMyTurn = status === "live" && !draftComplete && currentMember?.profileId === currentUserId;

  const pickedPlayerIds = useMemo(() => new Set(picks.map((p) => p.player_id)), [picks]);
  const availablePlayers = players.filter((p) => !pickedPlayerIds.has(p.id));

  const orderedPicks = useMemo(
    () => [...picks].sort((a, b) => b.pick_number - a.pick_number),
    [picks]
  );
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  async function makePick(playerId: string) {
    if (!isMyTurn || pendingPlayerId) return;
    setError(null);
    setPendingPlayerId(playerId);
    const supabase = createClient();
    const { error } = await supabase.from("picks").insert({
      league_id: league.id,
      player_id: playerId,
    });
    if (error) {
      setError(error.message);
      setPendingPlayerId(null);
    }
    // On success, the realtime INSERT event above updates local state.
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{league.name}</h1>
        <p className="text-neutral-600 text-sm">
          {league.season} · Round {round} of {league.numRounds} · Pick {Math.min(picksMade + 1, totalPicks)} of{" "}
          {totalPicks}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {draftComplete ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md px-4 py-3 flex items-center justify-between">
          <span className="font-medium">Draft complete!</span>
          <Link href={`/leagues/${league.id}/rosters`} className="underline text-sm">
            View final rosters →
          </Link>
        </div>
      ) : status !== "live" ? (
        <p className="text-neutral-600">This draft hasn&apos;t started yet.</p>
      ) : (
        <div
          className={`rounded-md px-4 py-3 border ${
            isMyTurn
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-neutral-100 border-neutral-200 text-neutral-700"
          }`}
        >
          {isMyTurn ? (
            <span className="font-medium">It&apos;s your turn — pick a castaway below.</span>
          ) : (
            <span>
              Waiting on <span className="font-medium">{currentMember?.displayName}</span> to
              pick&hellip;
            </span>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          <h2 className="font-semibold">Available castaways</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {availablePlayers.map((player) => (
              <button
                key={player.id}
                onClick={() => makePick(player.id)}
                disabled={!isMyTurn || pendingPlayerId !== null}
                className="text-left border border-neutral-200 rounded-lg p-3 bg-white hover:border-neutral-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <div className="font-medium">
                  {player.name}
                  {pendingPlayerId === player.id && (
                    <span className="text-neutral-400"> — picking…</span>
                  )}
                </div>
                {player.tribe && <div className="text-xs text-neutral-500">{player.tribe} tribe</div>}
                {player.bio && <div className="text-xs text-neutral-500 mt-1">{player.bio}</div>}
              </button>
            ))}
            {availablePlayers.length === 0 && (
              <p className="text-sm text-neutral-500">No castaways left.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-semibold mb-2">Draft order</h2>
            <ol className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-200">
              {members.map((m) => (
                <li
                  key={m.id}
                  className={`px-3 py-2 text-sm flex items-center justify-between ${
                    currentMember?.id === m.id ? "bg-emerald-50 font-medium" : ""
                  }`}
                >
                  <span>
                    #{m.draftPosition} {m.displayName}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h2 className="font-semibold mb-2">Recent picks</h2>
            <ul className="border border-neutral-200 rounded-lg bg-white divide-y divide-neutral-200 max-h-96 overflow-y-auto">
              {orderedPicks.map((pick) => (
                <li key={pick.id} className="px-3 py-2 text-sm">
                  <span className="text-neutral-500">#{pick.pick_number}</span>{" "}
                  <span className="font-medium">
                    {memberByProfileId.get(pick.profile_id)?.displayName ?? "Someone"}
                  </span>{" "}
                  drafted {playerById.get(pick.player_id)?.name ?? "a castaway"}
                </li>
              ))}
              {orderedPicks.length === 0 && (
                <li className="px-3 py-2 text-sm text-neutral-500">No picks yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
