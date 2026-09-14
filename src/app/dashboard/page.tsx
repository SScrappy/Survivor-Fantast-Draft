import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinLeagueByCode } from "@/lib/actions/leagues";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("profile_id", user.id);

  const leagueIds = (memberships ?? []).map((m) => m.league_id);

  const { data: leagues } = leagueIds.length
    ? await supabase
        .from("leagues")
        .select("id, name, season, status, num_drafters, num_rounds")
        .in("id", leagueIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Leagues</h1>
        <Link
          href="/leagues/new"
          className="bg-neutral-900 text-white px-4 py-2 rounded-md hover:bg-neutral-700 text-sm"
        >
          + Create a league
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!leagues || leagues.length === 0 ? (
        <p className="text-neutral-600">
          You&apos;re not in any leagues yet. Create one, or join with an invite code below.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {leagues.map((league) => (
            <li key={league.id}>
              <Link
                href={`/leagues/${league.id}`}
                className="block border border-neutral-200 rounded-lg p-4 bg-white hover:border-neutral-400 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{league.name}</h2>
                  <StatusBadge status={league.status} />
                </div>
                <p className="text-sm text-neutral-600 mt-1">
                  {league.season} · {league.num_drafters} drafters · {league.num_rounds} rounds
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border border-neutral-200 rounded-lg p-5 bg-white max-w-sm">
        <h2 className="font-semibold mb-3">Join a league</h2>
        <form action={joinLeagueByCode} className="flex gap-2">
          <input
            name="code"
            placeholder="Invite code"
            required
            className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="bg-neutral-900 text-white px-3 py-2 rounded-md text-sm hover:bg-neutral-700"
          >
            Join
          </button>
        </form>
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
