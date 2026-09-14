"use client";

import { useRef, useState, useTransition } from "react";
import { addHallOfFameEntry } from "@/lib/actions/hallOfFame";

export default function HallOfFameForm({
  profiles,
}: {
  profiles: { id: string; display_name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addHallOfFameEntry(formData);
      if (result.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <input
          name="season"
          placeholder="Survivor 48"
          required
          className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
        />
        <select
          name="winnerProfileId"
          required
          defaultValue=""
          className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Winner
          </option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="bg-neutral-900 text-white px-3 py-2 rounded-md text-sm hover:bg-neutral-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}
