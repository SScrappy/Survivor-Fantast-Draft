import { createLeague } from "@/lib/actions/leagues";

export default async function NewLeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Create a league</h1>
      {error && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <form action={createLeague} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="name">
            League name
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full border border-neutral-300 rounded-md px-3 py-2"
            placeholder="Office Survivor Pool"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="season">
            Season
          </label>
          <input
            id="season"
            name="season"
            defaultValue="Survivor 51"
            required
            className="w-full border border-neutral-300 rounded-md px-3 py-2"
          />
          <p className="text-xs text-neutral-500 mt-1">
            Must match the season the player pool was seeded with.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="numDrafters">
              Number of drafters
            </label>
            <input
              id="numDrafters"
              name="numDrafters"
              type="number"
              min={2}
              max={20}
              defaultValue={8}
              required
              className="w-full border border-neutral-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="numRounds">
              Number of rounds
            </label>
            <input
              id="numRounds"
              name="numRounds"
              type="number"
              min={1}
              max={30}
              defaultValue={3}
              required
              className="w-full border border-neutral-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-neutral-900 text-white rounded-md py-2.5 hover:bg-neutral-700"
        >
          Create league
        </button>
      </form>
    </div>
  );
}
