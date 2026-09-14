"use client";

import { signOut } from "@/lib/actions/auth";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-sm text-neutral-600 hover:text-neutral-900 cursor-pointer"
      >
        Sign out
      </button>
    </form>
  );
}
