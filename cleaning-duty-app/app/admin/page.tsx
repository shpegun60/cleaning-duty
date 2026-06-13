import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
import {
  activateScheduledDutiesForDate,
  listCurrentAndUpcomingDuties,
  listFailedNotifications,
  listProfiles,
} from "@/lib/data/store";
import { getLocalSchedulerState } from "@/lib/scheduler/dates";
import type { DutyPeriod, Notification, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const localDate = getLocalSchedulerState().dateKey;
  await activateScheduledDutiesForDate(localDate);

  const [duties, notifications, profiles] = await Promise.all([
    listCurrentAndUpcomingDuties(localDate, 8),
    listFailedNotifications(),
    listProfiles(),
  ]);
  const profileMap = new Map(
    (profiles as Profile[]).map((profile) => [profile.id, profile]),
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Адмінка</h1>
        <p className="mt-1 text-stone-600">
          Поточний стан чергувань, проблеми email і швидкі переходи.
        </p>
      </div>

      <section className="rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Актуальні та наступні чергування</h2>
        <div className="grid gap-2">
          {(duties as DutyPeriod[]).map((duty) => (
            <Link
              key={duty.id}
              className="grid gap-2 rounded-md border border-stone-100 p-3 hover:bg-stone-50 sm:grid-cols-[1fr_auto_auto]"
              href={`/duty/${duty.id}`}
            >
              <span>
                <span className="block font-semibold">{duty.week_start} - {duty.week_end}</span>
                <span className="text-sm text-stone-600">
                  {profileMap.get(duty.assignee_id)?.full_name ?? duty.assignee_id}
                </span>
              </span>
              <StatusBadge status={duty.status} />
              <span className="text-sm text-stone-500">{duty.id.slice(0, 8)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-amber-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Найближчі передачі чергування</h2>
        <div className="grid gap-2">
          {(duties as DutyPeriod[]).map((duty) => (
            <Link
              key={duty.id}
              className="grid gap-2 rounded-md border border-amber-100 p-3 hover:bg-amber-50 sm:grid-cols-[0.8fr_1fr_1fr_auto]"
              href={`/handover/${duty.id}`}
            >
              <span>
                <span className="block text-xs font-medium uppercase text-stone-500">
                  Дата передачі
                </span>
                <span className="block font-semibold">{duty.week_end}</span>
              </span>
              <span>
                <span className="block text-xs font-medium uppercase text-stone-500">
                  Передає
                </span>
                <span>{profileMap.get(duty.assignee_id)?.full_name ?? duty.assignee_id}</span>
              </span>
              <span>
                <span className="block text-xs font-medium uppercase text-stone-500">
                  Приймає
                </span>
                <span>
                  {duty.next_assignee_id
                    ? profileMap.get(duty.next_assignee_id)?.full_name ?? duty.next_assignee_id
                    : "Не задано"}
                </span>
              </span>
              <span className="rounded-md border border-stone-300 bg-white px-3 py-2 text-center text-sm font-semibold">
                Відкрити
              </span>
            </Link>
          ))}
          {duties.length === 0 ? (
            <p className="text-sm text-stone-600">Немає запланованих передач.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Failed notifications</h2>
        <div className="grid gap-2">
          {(notifications.slice(0, 8) as Notification[]).map((notification) => (
            <div key={notification.id} className="rounded-md border border-stone-100 p-3">
              <p className="font-semibold">{notification.type}</p>
              <p className="text-sm text-stone-600">{notification.error_message}</p>
            </div>
          ))}
          {notifications.length === 0 ? (
            <p className="text-sm text-stone-600">Немає failed notifications.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
