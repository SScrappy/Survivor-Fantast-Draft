import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startDraft } from "@/lib/actions/leagues";
import DraftOrderEditor from "@/components/DraftOrderEditor";

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase.from("leagues").select("*").eq("id", id).single();
  if (!league) notFound();

  const { data: memberRows } = await supabase
    .from("league_members")
    .select("id, profile_id, draft_position")
    .eq("league_id", id)
    .order("draft_position", { ascending: true, nullsFirst: false });

  const profileIds = (memberRows ?? []).map((m) => m.profile_id);
  const { data: profiles } = profileIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", profileIds)
    : { data: [] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const members = (memberRows ?? []).map((m) => ({
    id: m.id,
    profileId: m.profile_id,
    displayName: nameById.get(m.profile_id) ?? "Unknown",
    draftPosition: m.draft_position,
  }));

  const isOwner = league.owner_id === user!.id;
  const isFull = members.length === league.num_drafters;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{league.name}</h1>
          <StatusBadge status={league.status} />
        </div>
        <p className="text-neutral-600 mt-1">
          {league.season} · {league.num_drafters} drafters · {league.num_rounds} rounds
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {league.status === "pending" && isOwner && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 max-w-sm">
          <h2 className="font-semibold mb-1">Invite drafters</h2>
          <p className="text-sm text-neutral-600 mb-2">
            Share this code — anyone with it can join from their dashboard.
          </p>
          <code className="block bg-neutral-100 rounded-md px-3 py-2 text-lg tracking-widest text-center">
            {league.invite_code}
          </code>
          <p className="text-xs text-neutral-500 mt-2">
            {members.length} / {league.num_drafters} joined
          </p>
        </div>
      )}

      {league.status === "pending" && (
        <div className="space-y-3">
          <h2 className="font-semibold">Draft order</h2>
          {isOwner ? (
            isFull ? (
              <>
                <DraftOrderEditor
                  leagueId={league.id}
                  members={members.map((m) => ({
                    id: m.id,
                    displayName: m.displayName,
                    draftPosition: m.draftPosition,
                  }))}
                />
                <form action={startDraft.bind(null, league.id)}>
                  <button
                    type="submit"
                    disabled={members.some((m) => m.draftPosition === null)}
                    className="bg-emerald-700 text-white rounded-md px-4 py-2 text-sm hover:bg-emerald-800 disabled:opacity-50"
                  >
                    Start the draft
                  </button>
                </form>
              </>
            ) : (
              <p className="text-neutral-600 text-sm">
                Waiting for {league.num_drafters - members.length} more drafter(s) to join before
                you can set the order and start.
              </p>
            )
          ) : (
            <p className="text-neutral-600 text-sm">
              Waiting on the league owner to set the draft order and start the draft.
            </p>
          )}
        </div>
      )}

      {league.status !== "pending" && (
        <div className="flex gap-3">
          <Link
            href={`/leagues/${league.id}/draft`}
            className="bg-neutral-900 text-white rounded-md px-4 py-2 text-sm hover:bg-neutral-700"
          >
            {league.status === "live" ? "Go to live draft" : "View draft recap"}
          </Link>
          <Link
            href={`/leagues/${league.id}/rosters`}
            className="border border-neutral-300 rounded-md px-4 py-2 text-sm hover:bg-neutral-100"
          >
            View rosters
          </Link>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-2">Members</h2>
        <ul className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>{m.displayName}</span>
              {m.draftPosition && (
                <span className="text-neutral-500">Pick #{m.draftPosition}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    live: "bg-emerald-100 text-emerald-800",
    complete: "bg-neutral-200 text-neutral-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}
