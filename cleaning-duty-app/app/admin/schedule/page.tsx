import Link from "next/link";

import { ScheduleTools } from "@/components/admin/admin-forms";
import { StatusBadge } from "@/components/ui/status-badge";
import { listDuties, listFailedNotifications, listProfiles } from "@/lib/data/store";
import type { DutyPeriod, Notification, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage() {
  const [dutyList, profileList, notificationList] = (await Promise.all([
    listDuties(52),
    listProfiles(),
    listFailedNotifications(),
  ])) as [DutyPeriod[], Profile[], Notification[]];
  const profileMap = new Map(profileList.map((profile) => [profile.id, profile]));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Графік</h1>
        <p className="mt-1 text-stone-600">
          Поточні, майбутні й минулі duty periods. Історія не переписується.
        </p>
      </div>
      <ScheduleTools
        duties={dutyList.filter((duty) => !["accepted", "cancelled", "force_closed"].includes(duty.status))}
        failedNotifications={notificationList}
        profiles={profileList}
      />
      <section className="rounded-md border border-stone-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Duty periods</h2>
        <div className="grid gap-2">
          {dutyList.map((duty) => (
            <div
              key={duty.id}
              className="grid gap-2 rounded-md border border-stone-100 p-3 sm:grid-cols-[1fr_auto_auto]"
            >
              <Link href={`/duty/${duty.id}`}>
                <span className="block font-semibold">{duty.week_start} - {duty.week_end}</span>
                <span className="text-sm text-stone-600">
                  {profileMap.get(duty.assignee_id)?.full_name ?? duty.assignee_id}
                  {duty.next_assignee_id
                    ? ` -> ${profileMap.get(duty.next_assignee_id)?.full_name ?? duty.next_assignee_id}`
                    : ""}
                </span>
              </Link>
              <StatusBadge status={duty.status} />
              <span className="text-sm text-stone-500">{duty.id.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
