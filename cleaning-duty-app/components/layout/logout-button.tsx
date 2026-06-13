"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      className="rounded-md border border-stone-300 bg-white px-3 py-2 font-semibold hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoggingOut}
      onClick={logout}
      type="button"
    >
      {isLoggingOut ? "Вихід..." : "Вийти"}
    </button>
  );
}
