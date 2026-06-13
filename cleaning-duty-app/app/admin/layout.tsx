import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireAdminPage } from "@/lib/auth/page-guards";

const links = [
  ["/admin", "Огляд"],
  ["/admin/users", "Люди"],
  ["/admin/rooms", "Кімнати"],
  ["/admin/tasks", "Роботи"],
  ["/admin/rotation", "Rotation"],
  ["/admin/schedule", "Графік"],
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap gap-2">
        {links.map(([href, label]) => (
          <Link
            key={href}
            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-stone-100"
            href={href}
          >
            {label}
          </Link>
        ))}
      </div>
      {children}
    </AppShell>
  );
}
