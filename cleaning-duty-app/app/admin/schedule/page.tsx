import { ScheduleTools } from "@/components/admin/admin-forms";
import {
  normalizeScheduleMonth,
  ScheduleCalendar,
  scheduleCalendarRange,
} from "@/components/admin/schedule-calendar";
import {
  getAppSettings,
  listDuties,
  listDutiesInRange,
  listFailedNotifications,
  listProfiles,
} from "@/lib/data/store";
import type { AppSettings, DutyPeriod, Notification, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const month = normalizeScheduleMonth(params?.month);
  const range = scheduleCalendarRange(month);
  const [toolDutyList, calendarDutyList, profileList, notificationList, settings] =
    (await Promise.all([
      listDuties(52),
      listDutiesInRange(range.gridStart, range.gridEnd),
      listProfiles(),
      listFailedNotifications(),
      getAppSettings(),
    ])) as [DutyPeriod[], DutyPeriod[], Profile[], Notification[], AppSettings];
  const actionableDuties = toolDutyList.filter(
    (duty) => !["accepted", "cancelled", "force_closed"].includes(duty.status),
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Графік</h1>
        <p className="mt-1 text-stone-600">
          Календар чергувань, одноразові заміни і генерація майбутнього графіка.
          Історія завершених чергувань не переписується.
        </p>
      </div>
      <ScheduleTools
        duties={actionableDuties}
        failedNotifications={notificationList}
        profiles={profileList}
        settings={settings}
      />
      <ScheduleCalendar duties={calendarDutyList} profiles={profileList} month={month} />
    </div>
  );
}
