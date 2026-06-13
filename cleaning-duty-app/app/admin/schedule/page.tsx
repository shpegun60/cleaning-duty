import Link from "next/link";

import { ScheduleTools } from "@/components/admin/admin-forms";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getAppSettings,
  listDuties,
  listFailedNotifications,
  listProfiles,
} from "@/lib/data/store";
import type { AppSettings, DutyPeriod, Notification, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const [dutyList, profileList, notificationList, settings] = (await Promise.all([
    listDuties(52),
    listProfiles(),
    listFailedNotifications(),
    getAppSettings(),
  ])) as [DutyPeriod[], Profile[], Notification[], AppSettings];
  const profileMap = new Map(profileList.map((profile) => [profile.id, profile]));
  const actionableDuties = dutyList.filter(
    (duty) => !["accepted", "cancelled", "force_closed"].includes(duty.status),
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Графік</h1>
        <p className="mt-1 text-stone-600">
          Періоди чергування, одноразові заміни і генерація майбутнього графіка.
          Історія завершених чергувань не переписується.
        </p>
      </div>
      <ScheduleTools
        duties={actionableDuties}
        failedNotifications={notificationList}
        profiles={profileList}
        settings={settings}
      />
      <section className="rounded-md border border-stone-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">Періоди чергування</h2>
          <p className="text-sm text-stone-600">
            Кожен рядок має свій діапазон дат, чергового, наступного приймаючого
            і поточний статус.
          </p>
        </div>
        <div className="grid gap-2">
          {dutyList.length > 0 ? (
            dutyList.map((duty) => (
              <Link
                key={duty.id}
                href={`/duty/${duty.id}`}
                className="grid gap-3 rounded-md border border-stone-100 p-3 transition hover:border-stone-300 sm:grid-cols-[1.2fr_1fr_1fr_auto]"
              >
                <span>
                  <span className="block text-xs font-medium uppercase text-stone-500">
                    Діапазон
                  </span>
                  <span className="block font-semibold">
                    {duty.week_start} - {duty.week_end}
                  </span>
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase text-stone-500">
                    Черговий
                  </span>
                  <span className="block">
                    {profileMap.get(duty.assignee_id)?.full_name ?? duty.assignee_id}
                  </span>
                </span>
                <span>
                  <span className="block text-xs font-medium uppercase text-stone-500">
                    Приймає
                  </span>
                  <span className="block">
                    {duty.next_assignee_id
                      ? profileMap.get(duty.next_assignee_id)?.full_name ?? duty.next_assignee_id
                      : "Не задано"}
                  </span>
                </span>
                <span className="flex items-center sm:justify-end">
                  <StatusBadge status={duty.status} />
                </span>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-stone-200 p-4 text-sm text-stone-600">
              Графік ще не згенерований.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
