import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/layout/logout-button";
import type { Profile } from "@/lib/types";

export function AppShell({
  user,
  children,
}: {
  user: Profile;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/dashboard" className="text-lg font-bold text-stone-950">
            Cleaning Duty
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <Link className="rounded-md px-3 py-2 hover:bg-stone-100" href="/dashboard">
              Мій огляд
            </Link>
            {user.role === "admin" ? (
              <Link className="rounded-md px-3 py-2 hover:bg-stone-100" href="/admin">
                Адмінка
              </Link>
            ) : null}
            <Link className="rounded-md px-3 py-2 hover:bg-stone-100" href="/setup">
              Setup
            </Link>
            <Link className="rounded-md px-3 py-2 hover:bg-stone-100" href="/profile">
              Профіль
            </Link>
            <span className="rounded-md bg-stone-100 px-3 py-2 text-stone-700">
              {user.full_name}
            </span>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
