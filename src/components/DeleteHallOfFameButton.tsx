"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteHallOfFameEntry } from "@/lib/actions/hallOfFame";

export default function DeleteHallOfFameButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await deleteHallOfFameEntry(id);
          router.refresh();
        })
      }
      disabled={pending}
      className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50"
    >
      Remove
    </button>
  );
}
