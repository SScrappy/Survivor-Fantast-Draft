import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-2xl mx-auto text-center py-16 space-y-6">
      <h1 className="text-4xl font-bold tracking-tight">Draft your Survivor season.</h1>
      <p className="text-neutral-600 text-lg">
        Create a league, invite your friends, and live-draft real castaways from the current
        Survivor season. Snake draft order, real-time picks, full rosters — all season long.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/signup"
          className="bg-neutral-900 text-white px-5 py-2.5 rounded-md hover:bg-neutral-700"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="border border-neutral-300 px-5 py-2.5 rounded-md hover:bg-neutral-100"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
