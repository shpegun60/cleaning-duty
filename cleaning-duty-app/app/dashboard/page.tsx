import Link from "next/link";

import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUserPage } from "@/lib/auth/page-guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DutyPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUserPage();
  const supabase = createSupabaseAdminClient();
  const { data: duties, error } = await supabase
    .from("duty_periods")
    .select("*")
    .or(`assignee_id.eq.${user.id},next_assignee_id.eq.${user.id}`)
    .in("status", [
      "active",
      "cleaning_done",
      "handover_pending",
      "rejected",
      "ready_for_recheck",
      "scheduled",
    ])
    .order("week_start", { ascending: true })
    .limit(10);

  if (error) {
    throw error;
  }

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Моє чергування</h1>
          <p className="mt-1 text-stone-600">
            Тут показане твоє поточне чергування і приймання, якщо воно очікується.
          </p>
        </div>
        {user.role === "admin" ? <ButtonLink href="/admin">Адмінка</ButtonLink> : null}
      </div>

      <div className="grid gap-3">
        {((duties ?? []) as DutyPeriod[]).map((duty) => (
          <section key={duty.id} className="rounded-md border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {duty.week_start} - {duty.week_end}
                </p>
                <div className="mt-2">
                  <StatusBadge status={duty.status} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {duty.assignee_id === user.id ? (
                  <Link className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-stone-100" href={`/duty/${duty.id}`}>
                    Роботи
                  </Link>
                ) : null}
                {duty.next_assignee_id === user.id ? (
                  <Link className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-stone-100" href={`/handover/${duty.id}`}>
                    Приймання
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ))}
        {(duties ?? []).length === 0 ? (
          <section className="rounded-md border border-stone-200 bg-white p-6 text-stone-600">
            Активних або майбутніх чергувань для тебе поки немає.
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
