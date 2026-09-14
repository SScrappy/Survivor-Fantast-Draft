"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addHallOfFameEntry(formData: FormData) {
  const season = String(formData.get("season") || "").trim();
  const winnerProfileId = String(formData.get("winnerProfileId") || "");

  const supabase = await createClient();
  const { error } = await supabase.from("hall_of_fame").insert({
    season,
    winner_profile_id: winnerProfileId,
  });

  revalidatePath("/hall-of-fame");
  return { error: error?.message ?? null };
}

export async function deleteHallOfFameEntry(id: string) {
  const supabase = await createClient();
  await supabase.from("hall_of_fame").delete().eq("id", id);
  revalidatePath("/hall-of-fame");
}
