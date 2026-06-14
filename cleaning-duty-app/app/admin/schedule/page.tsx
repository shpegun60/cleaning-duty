import { ScheduleTools } from "@/components/admin/admin-forms";
import { ScheduleCalendar } from "@/components/admin/schedule-calendar";
import {
  getAppSettings,
  hasDutySchedule,
  listActiveAssigneeChangesForDuties,
  listAllDuties,
  listDutiesInRange,
  listFailedNotifications,
  listProfiles,
} from "@/lib/data/store";
import {
  scheduleViewRange,
} from "@/lib/domain/schedule-calendar";
import type {
  AppSettings,
  AssigneeChange,
  DutyPeriod,
  Notification,
  Profile,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const closedDutyStatuses = new Set<DutyPeriod["status"]>([
  "accepted",
  "force_closed",
  "overdue",
  "cancelled",
]);
const inProgressDutyStatuses = new Set<DutyPeriod["status"]>([
  "active",
  "grace",
  "cleaning_done",
  "handover_pending",
  "rejected",
  "ready_for_recheck",
]);

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams?: Promise<{
    month?: string | string[];
    start?: string | string[];
    end?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const range = scheduleViewRange({
    month: params?.month,
    start: params?.start,
    end: params?.end,
  });
  const [
    calendarDutyList,
    allDutyList,
    profileList,
    notificationList,
    settings,
    scheduleLocked,
  ] =
    (await Promise.all([
      listDutiesInRange(range.gridStart, range.gridEnd),
      listAllDuties(),
      listProfiles(),
      listFailedNotifications(),
      getAppSettings(),
      hasDutySchedule(),
    ])) as [DutyPeriod[], DutyPeriod[], Profile[], Notification[], AppSettings, boolean];
  const [activeChanges, allActiveChanges] = (await Promise.all([
    listActiveAssigneeChangesForDuties(calendarDutyList.map((duty) => duty.id)),
    listActiveAssigneeChangesForDuties(allDutyList.map((duty) => duty.id)),
  ])) as [AssigneeChange[], AssigneeChange[]];

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
        scheduleLocked={scheduleLocked}
      />
      <AdminScheduleSummary
        duties={allDutyList}
        changes={allActiveChanges}
        profiles={profileList}
        settings={settings}
      />
      <ScheduleCalendar
        duties={calendarDutyList}
        profiles={profileList}
        month={range.month}
        viewStart={range.start ?? range.gridStart}
        viewEnd={range.end ?? range.gridEnd}
        isCustomRange={range.mode === "range"}
        changes={activeChanges}
        gracePeriodDays={settings.grace_period_days}
      />
    </div>
  );
}

function AdminScheduleSummary({
  duties,
  changes,
  profiles,
  settings,
}: {
  duties: DutyPeriod[];
  changes: AssigneeChange[];
  profiles: Profile[];
  settings: AppSettings;
}) {
  const orderedDuties = [...duties].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const firstDuty = orderedDuties[0] ?? null;
  const lastDuty = orderedDuties[orderedDuties.length - 1] ?? null;
  const accepted = duties.filter((duty) => duty.status === "accepted").length;
  const remaining = duties.filter((duty) => !closedDutyStatuses.has(duty.status)).length;
  const scheduled = duties.filter((duty) => duty.status === "scheduled").length;
  const grace = duties.filter((duty) => duty.status === "grace").length;
  const overdue = duties.filter((duty) => duty.status === "overdue").length;
  const inProgress = duties.filter((duty) => inProgressDutyStatuses.has(duty.status)).length;
  const cancelledOrClosed = duties.filter(
    (duty) =>
      duty.status === "cancelled" ||
      duty.status === "force_closed" ||
      duty.status === "overdue",
  ).length;
  const handovers = duties.filter((duty) => Boolean(duty.next_assignee_id)).length;
  const activeWorkers = profiles.filter(
    (profile) =>
      profile.role === "worker" &&
      profile.is_active &&
      profile.rotation_order !== null &&
      profile.rotation_order >= 1,
  ).length;
  const coverageDays = scheduleCoverageDays(firstDuty, lastDuty) ?? "Немає";

  const metrics = [
    {
      label: "Повний діапазон графіка",
      value: formatDateRange(firstDuty?.week_start ?? null, lastDuty?.week_end ?? null),
      detail: coverageDays,
    },
    {
      label: "Чергувань загалом",
      value: String(duties.length),
      detail: `${handovers} передач`,
    },
    {
      label: "Залишилось",
      value: String(remaining),
      detail: `${scheduled} заплановано / ${inProgress} у роботі`,
    },
    {
      label: "Grace / overdue",
      value: `${grace} / ${overdue}`,
      detail:
        settings.grace_period_days > 0
          ? `${settings.grace_period_days} днів grace`
          : "grace вимкнено",
    },
    {
      label: "Прийнято",
      value: String(accepted),
      detail: `${cancelledOrClosed} скасовано/закрито`,
    },
    {
      label: "Активні заміни",
      value: String(changes.length),
      detail: "по всьому графіку",
    },
    {
      label: "Людей у ротації",
      value: String(activeWorkers),
      detail: "active worker з rotation order",
    },
  ];

  return (
    <section className="rounded-md border border-stone-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Загальна інформація по всьому графіку</h2>
        <p className="mt-1 text-sm text-stone-600">
          Ці цифри рахуються по всіх згенерованих чергуваннях, а не тільки по відкритому місяцю.
        </p>
      </div>
      <dl className="grid gap-x-4 gap-y-3 border-y border-stone-200 bg-stone-50 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="min-w-0">
            <dt className="text-xs font-semibold uppercase text-stone-500 [overflow-wrap:anywhere]">
              {metric.label}
            </dt>
            <dd className="mt-1 text-base font-semibold leading-tight text-stone-950 [overflow-wrap:anywhere]">
              {metric.value}
            </dd>
            <dd className="mt-1 text-xs leading-tight text-stone-600 [overflow-wrap:anywhere]">
              {metric.detail}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) {
    return "Немає";
  }

  if (startDate === endDate) {
    return startDate;
  }

  return `${startDate} - ${endDate}`;
}

function scheduleCoverageDays(firstDuty: DutyPeriod | null, lastDuty: DutyPeriod | null) {
  if (!firstDuty || !lastDuty) {
    return null;
  }

  const startDate = new Date(`${firstDuty.week_start}T00:00:00`);
  const endDate = new Date(`${lastDuty.week_end}T00:00:00`);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;

  return `${days} днів покриття`;
}
