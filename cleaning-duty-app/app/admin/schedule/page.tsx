import { ScheduleTools } from "@/components/admin/admin-forms";
import { ScheduleCalendar } from "@/components/admin/schedule-calendar";
import {
  getAppSettings,
  listActiveAssigneeChangesForDuties,
  listDutiesInRange,
  listFailedNotifications,
  listProfiles,
} from "@/lib/data/store";
import {
  normalizeScheduleMonth,
  scheduleCalendarRange,
} from "@/lib/domain/schedule-calendar";
import type {
  AppSettings,
  AssigneeChange,
  DutyPeriod,
  Notification,
  Profile,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const month = normalizeScheduleMonth(params?.month);
  const range = scheduleCalendarRange(month);
  const [calendarDutyList, profileList, notificationList, settings] =
    (await Promise.all([
      listDutiesInRange(range.gridStart, range.gridEnd),
      listProfiles(),
      listFailedNotifications(),
      getAppSettings(),
    ])) as [DutyPeriod[], Profile[], Notification[], AppSettings];
  const activeChanges = (await listActiveAssigneeChangesForDuties(
    calendarDutyList.map((duty) => duty.id),
  )) as AssigneeChange[];

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
        failedNotifications={notificationList}
        profiles={profileList}
        settings={settings}
      />
      <ScheduleCalendar
        duties={calendarDutyList}
        profiles={profileList}
        month={month}
        changes={activeChanges}
      />
    </div>
  );
}
