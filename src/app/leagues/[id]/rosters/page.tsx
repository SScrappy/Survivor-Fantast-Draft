import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RostersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: league } = await supabase.from("leagues").select("*").eq("id", id).single();
  if (!league) notFound();

  const { data: rosterRows } = await supabase
    .from("rosters")
    .select("*")
    .eq("league_id", id);

  const byMember = new Map<string, { displayName: string; picks: typeof rosterRows }>();
  for (const row of rosterRows ?? []) {
    if (!byMember.has(row.profile_id)) {
      byMember.set(row.profile_id, { displayName: row.display_name, picks: [] });
    }
    byMember.get(row.profile_id)!.picks!.push(row);
  }

  const rosterGroups = [...byMember.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{league.name} — Rosters</h1>
          <p className="text-neutral-600 text-sm">{league.season}</p>
        </div>
        <Link href={`/leagues/${league.id}`} className="text-sm underline">
          ← Back to league
        </Link>
      </div>

      {rosterGroups.length === 0 ? (
        <p className="text-neutral-600">No picks have been made yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rosterGroups.map((group) => (
            <div key={group.displayName} className="border border-neutral-200 rounded-lg bg-white p-4">
              <h2 className="font-semibold mb-2">{group.displayName}</h2>
              <ul className="space-y-1">
                {group
                  .picks!.sort((a, b) => a.pick_number - b.pick_number)
                  .map((pick) => (
                    <li key={pick.player_id} className="text-sm flex justify-between">
                      <span>{pick.player_name}</span>
                      <span className="text-neutral-400">R{pick.round}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
