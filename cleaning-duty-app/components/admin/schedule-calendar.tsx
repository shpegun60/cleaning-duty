"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AssigneeChange, DutyPeriod, Profile } from "@/lib/types";

const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const monthLabels = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

const dutyStyles = [
  "border-emerald-200 bg-emerald-50 text-emerald-950",
  "border-sky-200 bg-sky-50 text-sky-950",
  "border-violet-200 bg-violet-50 text-violet-950",
  "border-amber-200 bg-amber-50 text-amber-950",
  "border-rose-200 bg-rose-50 text-rose-950",
  "border-cyan-200 bg-cyan-50 text-cyan-950",
];

const closedDutyStatuses = new Set<DutyPeriod["status"]>([
  "accepted",
  "force_closed",
  "overdue",
  "cancelled",
]);
const waitingPreviousStatuses = new Set<DutyPeriod["status"]>([
  "grace",
  "cleaning_done",
  "handover_pending",
  "ready_for_recheck",
]);

type CalendarMetric = {
  label: string;
  value: string;
  detail?: string;
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload;
}

export function ScheduleCalendar({
  duties,
  profiles,
  month,
  viewStart,
  viewEnd,
  isCustomRange,
  changes,
  readOnly = false,
  pagePath = "/admin/schedule",
  extraQuery,
  viewerUserId,
  gracePeriodDays = 0,
}: {
  duties: DutyPeriod[];
  profiles: Profile[];
  month: string;
  viewStart: string;
  viewEnd: string;
  isCustomRange: boolean;
  changes: AssigneeChange[];
  readOnly?: boolean;
  pagePath?: string;
  extraQuery?: Record<string, string>;
  viewerUserId?: string;
  gracePeriodDays?: number;
}) {
  const router = useRouter();
  const [editingDutyId, setEditingDutyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const monthDate = parseISO(`${month}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const viewStartDate = parseISO(viewStart);
  const viewEndDate = parseISO(viewEnd);
  const gridStart = isCustomRange
    ? startOfWeek(viewStartDate, { weekStartsOn: 1 })
    : startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = isCustomRange
    ? endOfWeek(viewEndDate, { weekStartsOn: 1 })
    : endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const profileIndexMap = useMemo(
    () => new Map(profiles.map((profile, index) => [profile.id, index])),
    [profiles],
  );
  const dutyMap = useMemo(
    () => new Map(duties.map((duty) => [duty.id, duty])),
    [duties],
  );
  const nextDutyById = useMemo(() => {
    const orderedDuties = [...duties].sort((a, b) =>
      a.week_start.localeCompare(b.week_start),
    );
    const map = new Map<string, DutyPeriod>();

    for (let index = 0; index < orderedDuties.length - 1; index += 1) {
      map.set(orderedDuties[index].id, orderedDuties[index + 1]);
    }

    return map;
  }, [duties]);
  const previousDutyById = useMemo(() => {
    const orderedDuties = [...duties].sort((a, b) =>
      a.week_start.localeCompare(b.week_start),
    );
    const map = new Map<string, DutyPeriod>();

    for (let index = 1; index < orderedDuties.length; index += 1) {
      map.set(orderedDuties[index].id, orderedDuties[index - 1]);
    }

    return map;
  }, [duties]);
  const activeRotationWorkers = profiles.filter(
    (profile) =>
      profile.role === "worker" &&
      profile.is_active &&
      profile.rotation_order !== null &&
      profile.rotation_order >= 1,
  );
  const latestChangeByDutyId = useMemo(() => {
    const map = new Map<string, AssigneeChange>();
    for (const change of changes) {
      if (!map.has(change.duty_period_id)) {
        map.set(change.duty_period_id, change);
      }
    }
    return map;
  }, [changes]);
  const changedDutyIds = new Set(changes.map((change) => change.duty_period_id));
  const previousMonth = format(addMonths(monthDate, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const currentMonth = format(new Date(), "yyyy-MM");
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const rangeLengthDays = differenceInCalendarDays(viewEndDate, viewStartDate) + 1;
  const editingDuty = editingDutyId ? dutyMap.get(editingDutyId) ?? null : null;
  const visibleDuties = useMemo(
    () =>
      duties.filter((duty) => duty.week_start <= viewEnd && duty.week_end >= viewStart),
    [duties, viewEnd, viewStart],
  );
  const visibleDutyIds = useMemo(
    () => new Set(visibleDuties.map((duty) => duty.id)),
    [visibleDuties],
  );
  const visibleChanges = useMemo(
    () => changes.filter((change) => visibleDutyIds.has(change.duty_period_id)),
    [changes, visibleDutyIds],
  );
  const visibleHandovers = visibleDuties.filter(
    (duty) => duty.week_end >= viewStart && duty.week_end <= viewEnd,
  );
  const acceptedDuties = visibleDuties.filter((duty) => duty.status === "accepted");
  const graceDuties = visibleDuties.filter((duty) => duty.status === "grace");
  const overdueDuties = visibleDuties.filter((duty) => duty.status === "overdue");
  const remainingDuties = visibleDuties.filter(
    (duty) => !closedDutyStatuses.has(duty.status),
  );
  const cancelledOrClosedDuties = visibleDuties.filter(
    (duty) =>
      duty.status === "cancelled" ||
      duty.status === "force_closed" ||
      duty.status === "overdue",
  );
  const dutyStarts = visibleDuties.map((duty) => duty.week_start).sort();
  const dutyEnds = visibleDuties.map((duty) => duty.week_end).sort();
  const myDutyCount = viewerUserId
    ? visibleDuties.filter((duty) => duty.assignee_id === viewerUserId).length
    : 0;
  const myHandoverCount = viewerUserId
    ? visibleHandovers.filter((duty) => {
        const nextAssigneeId =
          duty.next_assignee_id ?? nextDutyById.get(duty.id)?.assignee_id ?? null;
        return nextAssigneeId === viewerUserId;
      }).length
    : 0;
  const calendarMetrics: CalendarMetric[] = [
    {
      label: "Видимий діапазон",
      value: formatDateRange(viewStart, viewEnd),
      detail: `${rangeLengthDays} днів`,
    },
    {
      label: "Чергувань у діапазоні",
      value: String(visibleDuties.length),
      detail: `${visibleHandovers.length} передач`,
    },
    {
      label: "Залишилось",
      value: String(remainingDuties.length),
      detail: "ще не закрито",
    },
    {
      label: "Прийнято",
      value: String(acceptedDuties.length),
      detail: `${cancelledOrClosedDuties.length} скасовано/закрито`,
    },
    {
      label: "Grace / overdue",
      value: `${graceDuties.length} / ${overdueDuties.length}`,
      detail:
        gracePeriodDays > 0
          ? `${gracePeriodDays} днів grace`
          : "grace вимкнено",
    },
    {
      label: "Заміни",
      value: String(visibleChanges.length),
      detail: "активні у цьому діапазоні",
    },
    {
      label: "Покриття графіка",
      value: formatDateRange(dutyStarts[0] ?? null, dutyEnds[dutyEnds.length - 1] ?? null),
      detail: visibleDuties.length > 0 ? "за duty periods" : "немає записів",
    },
  ];

  if (viewerUserId) {
    calendarMetrics.push({
      label: "Мої дії",
      value: String(myDutyCount + myHandoverCount),
      detail: `${myDutyCount} робіт / ${myHandoverCount} приймань`,
    });
  }

  const defaultNewAssigneeId =
    activeRotationWorkers.find((profile) => profile.id !== editingDuty?.assignee_id)?.id ?? "";

  async function run(callback: () => Promise<void>) {
    setMessage(null);
    setBusy(true);

    try {
      await callback();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setBusy(false);
    }
  }

  function goToMonth(targetMonth: string) {
    router.push(calendarUrl(pagePath, extraQuery, { month: targetMonth }), { scroll: false });
  }

  function goToRange(startDate: string, endDate: string) {
    router.push(calendarUrl(pagePath, extraQuery, { start: startDate, end: endDate }), { scroll: false });
  }

  function chooseMonth(event: FormEvent<HTMLInputElement>) {
    const targetMonth = event.currentTarget.value;

    if (/^\d{4}-\d{2}$/.test(targetMonth)) {
      goToMonth(targetMonth);
    }
  }

  function chooseRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startDate = String(form.get("startDate") ?? "");
    const endDate = String(form.get("endDate") ?? "");

    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      goToRange(startDate, endDate);
    }
  }

  function shiftVisibleRange(direction: -1 | 1) {
    if (!isCustomRange) {
      goToMonth(direction < 0 ? previousMonth : nextMonth);
      return;
    }

    const offset = direction * rangeLengthDays;
    goToRange(
      format(addDays(viewStartDate, offset), "yyyy-MM-dd"),
      format(addDays(viewEndDate, offset), "yyyy-MM-dd"),
    );
  }

  async function changeAssignee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDuty) return;
    const form = new FormData(event.currentTarget);

    await run(async () => {
      await postJson("/api/admin/change-assignee", {
        dutyPeriodId: editingDuty.id,
        newAssigneeId: String(form.get("newAssigneeId") ?? ""),
        reason: String(form.get("reason") ?? ""),
      });
      setEditingDutyId(null);
      setMessage("Зміну збережено");
    });
  }

  async function revertChange(changeId: string) {
    if (!window.confirm("Відмінити цю зміну чергового?")) {
      return;
    }

    await run(async () => {
      await postJson("/api/admin/revert-assignee-change", { changeId });
      setMessage("Зміну відмінено");
    });
  }

  return (
    <section className="rounded-md border border-stone-200 bg-white p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Календар чергувань</h2>
          <p className="text-sm text-stone-600">
            Діапазон показує, хто чергує. Останній день діапазону позначений як день передачі.
          </p>
        </div>
        <div className="grid gap-2 sm:min-w-80">
          <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
            <button
              type="button"
              className="flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white text-lg font-semibold hover:bg-stone-100"
              onClick={() => shiftVisibleRange(-1)}
              aria-label="Попередній місяць"
            >
              ‹
            </button>
            <span className="min-w-40 text-center font-semibold">
              {isCustomRange
                ? `${viewStart} - ${viewEnd}`
                : `${monthLabels[monthDate.getMonth()]} ${format(monthDate, "yyyy")}`}
            </span>
            <button
              type="button"
              className="flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white text-lg font-semibold hover:bg-stone-100"
              onClick={() => shiftVisibleRange(1)}
              aria-label="Наступний місяць"
            >
              ›
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              aria-label="Вибрати місяць і рік"
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm"
              type="month"
              value={month}
              onChange={chooseMonth}
            />
            <button
              type="button"
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => goToMonth(currentMonth)}
              disabled={!isCustomRange && month === currentMonth}
            >
              Сьогодні
            </button>
          </div>
          <form onSubmit={chooseRange} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              aria-label="Початок діапазону"
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm"
              name="startDate"
              type="date"
              defaultValue={isCustomRange ? viewStart : format(monthStart, "yyyy-MM-dd")}
            />
            <input
              aria-label="Кінець діапазону"
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm"
              name="endDate"
              type="date"
              defaultValue={isCustomRange ? viewEnd : format(monthEnd, "yyyy-MM-dd")}
            />
            <button
              type="submit"
              className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:bg-stone-100"
            >
              Діапазон
            </button>
          </form>
        </div>
      </div>

      <CalendarTelemetry metrics={calendarMetrics} />

      <div className="overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-7 rounded-md border border-stone-200">
          {dayLabels.map((label) => (
            <div
              key={label}
              className="border-b border-stone-200 bg-stone-50 px-2 py-2 text-center text-xs font-semibold uppercase text-stone-500"
            >
              {label}
            </div>
          ))}
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const duty = dutyForDay(duties, dateKey);
            const latestChange = duty ? latestChangeByDutyId.get(duty.id) : null;
            const nextDuty = duty ? nextDutyById.get(duty.id) ?? null : null;
            const previousDuty = duty ? previousDutyById.get(duty.id) ?? null : null;
            const nextAssigneeId = nextDuty?.assignee_id ?? duty?.next_assignee_id ?? null;
            const nextAssignee = nextAssigneeId ? profileMap.get(nextAssigneeId) : null;
            const assignee = duty ? profileMap.get(duty.assignee_id) : null;
            const isInViewRange = day >= viewStartDate && day <= viewEndDate;
            const isHandoverDay = duty?.week_end === dateKey;
            const isChanged = duty ? changedDutyIds.has(duty.id) : false;
            const isWaitingForPrevious = Boolean(
              duty &&
                duty.status === "scheduled" &&
                previousDuty &&
                previousDuty.week_end < duty.week_start &&
                waitingPreviousStatuses.has(previousDuty.status),
            );
            const canOpenOwnDuty = Boolean(
              readOnly && viewerUserId && duty?.assignee_id === viewerUserId,
            );
            const canOpenOwnHandover = Boolean(
              readOnly && viewerUserId && nextAssigneeId === viewerUserId,
            );
            const style = duty
              ? isChanged
                ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-950"
                : duty.status === "overdue"
                  ? "border-red-300 bg-red-50 text-red-950"
                  : duty.status === "grace"
                    ? "border-amber-300 bg-amber-50 text-amber-950"
                    : isWaitingForPrevious
                      ? "border-stone-300 bg-stone-100 text-stone-900"
                : dutyStyles[(profileIndexMap.get(duty.assignee_id) ?? 0) % dutyStyles.length]
              : "";

            return (
              <div
                key={dateKey}
                className={`min-h-40 min-w-0 border-b border-r border-stone-200 p-2 ${
                  isInViewRange ? "bg-white" : "bg-stone-50 text-stone-400"
                } ${dateKey === todayKey ? "ring-2 ring-emerald-600 ring-inset" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{format(day, "d")}</span>
                  {duty ? (
                    <span className="hidden xl:block">
                      <StatusBadge status={duty.status} />
                    </span>
                  ) : null}
                </div>
                {duty ? (
                  <div className={`min-w-0 overflow-hidden rounded-md border px-2 py-1.5 text-xs ${style}`}>
                    {canOpenOwnDuty ? (
                      <Link href={`/duty/${duty.id}`} className="block rounded-sm hover:underline">
                        <span className="block font-semibold leading-tight [overflow-wrap:anywhere]">
                          {assignee?.full_name ?? duty.assignee_id}
                        </span>
                        <span className="mt-1 block text-[11px] leading-tight opacity-80 [overflow-wrap:anywhere]">
                          {duty.week_start} - {duty.week_end}
                        </span>
                        <span className="mt-1 inline-flex max-w-full rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold leading-tight">
                          Роботи
                        </span>
                      </Link>
                    ) : readOnly ? (
                      <span className="block">
                        <span className="block font-semibold leading-tight [overflow-wrap:anywhere]">
                          {assignee?.full_name ?? duty.assignee_id}
                        </span>
                        <span className="mt-1 block text-[11px] leading-tight opacity-80 [overflow-wrap:anywhere]">
                          {duty.week_start} - {duty.week_end}
                        </span>
                      </span>
                    ) : (
                      <Link href={`/duty/${duty.id}`} className="block">
                        <span className="block font-semibold leading-tight [overflow-wrap:anywhere]">
                          {assignee?.full_name ?? duty.assignee_id}
                        </span>
                        <span className="mt-1 block text-[11px] leading-tight opacity-80 [overflow-wrap:anywhere]">
                          {duty.week_start} - {duty.week_end}
                        </span>
                      </Link>
                    )}
                    {isChanged ? (
                      <span className="mt-1 inline-flex max-w-full rounded-md bg-fuchsia-200 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-fuchsia-950">
                        Змінено
                      </span>
                    ) : null}
                    {isWaitingForPrevious ? (
                      <span className="mt-1 inline-flex max-w-full rounded-md bg-stone-200 px-1.5 py-0.5 text-[11px] font-semibold leading-tight text-stone-800">
                        Очікує завершення попереднього
                      </span>
                    ) : null}
                    {!readOnly ? (
                      <div className="mt-2 grid gap-1">
                        <button
                          type="button"
                          className="min-h-8 w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-center text-xs font-semibold leading-tight text-stone-900 hover:bg-stone-100 [overflow-wrap:anywhere]"
                          onClick={() => setEditingDutyId(duty.id)}
                          disabled={busy || activeRotationWorkers.length < 2}
                        >
                          Змінити
                        </button>
                        {latestChange ? (
                          <button
                            type="button"
                            className="min-h-8 w-full rounded-md border border-red-300 bg-white px-2 py-1 text-center text-xs font-semibold leading-tight text-red-800 hover:bg-red-50 [overflow-wrap:anywhere]"
                            onClick={() => revertChange(latestChange.id)}
                            disabled={busy}
                          >
                            Відмінити
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {isHandoverDay && duty ? (
                  readOnly && canOpenOwnHandover ? (
                    <Link
                      href={`/handover/${duty.id}`}
                      className={`mt-2 block min-w-0 overflow-hidden rounded-md border px-2 py-1 text-xs font-semibold leading-tight ${handoverClassName(duty.status)}`}
                    >
                      <HandoverContent duty={duty} nextAssignee={nextAssignee} />
                    </Link>
                  ) : readOnly ? (
                    <div
                      className={`mt-2 block min-w-0 overflow-hidden rounded-md border px-2 py-1 text-xs font-semibold leading-tight ${handoverClassName(duty.status)}`}
                    >
                      <HandoverContent duty={duty} nextAssignee={nextAssignee} />
                    </div>
                  ) : (
                    <Link
                      href={`/handover/${duty.id}`}
                      className={`mt-2 block min-w-0 overflow-hidden rounded-md border px-2 py-1 text-xs font-semibold leading-tight ${handoverClassName(duty.status)}`}
                    >
                      <HandoverContent duty={duty} nextAssignee={nextAssignee} />
                    </Link>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <AssigneeChangesTable
        changes={changes}
        dutyMap={dutyMap}
        profileMap={profileMap}
        latestChangeByDutyId={latestChangeByDutyId}
        busy={busy}
        onRevert={revertChange}
        readOnly={readOnly}
      />

      {message ? <p className="mt-3 text-sm text-stone-700">{message}</p> : null}

      {editingDuty && !readOnly ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <form
            onSubmit={changeAssignee}
            className="grid w-full max-w-md gap-3 rounded-md bg-white p-4 shadow-xl"
          >
            <div>
              <h3 className="text-lg font-semibold">Змінити чергового</h3>
              <p className="text-sm text-stone-600">
                {editingDuty.week_start} - {editingDuty.week_end}
              </p>
            </div>
            <label className="grid gap-1 text-sm">
              Новий черговий
              <select
                className="h-10 rounded-md border px-3"
                name="newAssigneeId"
                defaultValue={defaultNewAssigneeId}
                required
              >
                {activeRotationWorkers
                  .filter((profile) => profile.id !== editingDuty.assignee_id)
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Причина заміни
              <input
                className="h-10 rounded-md border px-3"
                name="reason"
                minLength={5}
                required
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="submit" className="w-full" disabled={busy || !defaultNewAssigneeId}>
                Зберегти
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => setEditingDutyId(null)}
                disabled={busy}
              >
                Скасувати
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

function CalendarTelemetry({ metrics }: { metrics: CalendarMetric[] }) {
  return (
    <dl className="mb-4 grid gap-x-4 gap-y-3 border-y border-stone-200 bg-stone-50 px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase text-stone-500 [overflow-wrap:anywhere]">
            {metric.label}
          </dt>
          <dd className="mt-1 text-base font-semibold leading-tight text-stone-950 [overflow-wrap:anywhere]">
            {metric.value}
          </dd>
          {metric.detail ? (
            <dd className="mt-1 text-xs leading-tight text-stone-600 [overflow-wrap:anywhere]">
              {metric.detail}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

function AssigneeChangesTable({
  changes,
  dutyMap,
  profileMap,
  latestChangeByDutyId,
  busy,
  onRevert,
  readOnly,
}: {
  changes: AssigneeChange[];
  dutyMap: Map<string, DutyPeriod>;
  profileMap: Map<string, Profile>;
  latestChangeByDutyId: Map<string, AssigneeChange>;
  busy: boolean;
  onRevert: (changeId: string) => void;
  readOnly: boolean;
}) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-md border border-stone-200">
      <div className="border-b border-stone-200 bg-stone-50 px-3 py-2">
        <h3 className="font-semibold">Активні заміни</h3>
      </div>
      <div className="grid gap-2 p-3">
        {changes.map((change) => {
          const duty = dutyMap.get(change.duty_period_id);
          const isLatest = latestChangeByDutyId.get(change.duty_period_id)?.id === change.id;

          return (
            <div
              key={change.id}
              className="grid gap-2 rounded-md border border-stone-100 p-3 md:grid-cols-[1fr_1fr_1.2fr_auto]"
            >
              <span>
                <span className="block text-xs font-medium uppercase text-stone-500">
                  Період
                </span>
                <span className="block font-semibold [overflow-wrap:anywhere]">
                  {duty ? `${duty.week_start} - ${duty.week_end}` : change.duty_period_id}
                </span>
              </span>
              <span>
                <span className="block text-xs font-medium uppercase text-stone-500">
                  Заміна
                </span>
                <span className="block [overflow-wrap:anywhere]">
                  {profileName(profileMap, change.previous_assignee_id)} {"->"}{" "}
                  {profileName(profileMap, change.new_assignee_id)}
                </span>
              </span>
              <span>
                <span className="block text-xs font-medium uppercase text-stone-500">
                  Причина
                </span>
                <span className="block [overflow-wrap:anywhere]">{change.reason}</span>
              </span>
              {!readOnly ? (
                <button
                  type="button"
                  className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-semibold leading-tight text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 [overflow-wrap:anywhere]"
                  onClick={() => onRevert(change.id)}
                  disabled={busy || !isLatest}
                  title={isLatest ? "Відмінити зміну" : "Спочатку відміни новішу зміну цього періоду"}
                >
                  Відмінити
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HandoverContent({
  duty,
  nextAssignee,
}: {
  duty: DutyPeriod;
  nextAssignee: Profile | undefined | null;
}) {
  return (
    <>
      <span className="grid min-w-0 gap-1">
        <span className="[overflow-wrap:anywhere]">
          {handoverDisplayLabel(duty, nextAssignee)}
        </span>
        <span className="min-w-0">
          <StatusBadge status={duty.status} />
        </span>
      </span>
      {duty.reject_comment ? (
        <span className="mt-1 block text-[11px] font-medium leading-tight [overflow-wrap:anywhere]">
          {duty.reject_comment}
        </span>
      ) : null}
    </>
  );
}

function calendarUrl(
  pagePath: string,
  extraQuery: Record<string, string> | undefined,
  params: Record<string, string>,
) {
  const query = new URLSearchParams({
    ...(extraQuery ?? {}),
    ...params,
  });
  return `${pagePath}?${query.toString()}`;
}

function profileName(profileMap: Map<string, Profile>, profileId: string | null) {
  if (!profileId) return "Не задано";
  return profileMap.get(profileId)?.full_name ?? profileId;
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

function handoverLabel(duty: DutyPeriod | undefined, nextAssignee: Profile | undefined | null) {
  if (!duty || !nextAssignee) return "Передача";

  if (nextAssignee.id === duty.assignee_id) {
    return `Продовжує ${nextAssignee.full_name}`;
  }

  return `Передача -> ${nextAssignee.full_name}`;
}

function handoverDisplayLabel(
  duty: DutyPeriod | undefined,
  nextAssignee: Profile | undefined | null,
) {
  if (!duty || !nextAssignee) return handoverLabel(duty, nextAssignee);

  if (duty.status === "accepted") {
    return `Прийнято -> ${nextAssignee.full_name}`;
  }

  if (duty.status === "rejected") {
    return `Не прийнято -> ${nextAssignee.full_name}`;
  }

  if (duty.status === "ready_for_recheck") {
    return `Повторна перевірка -> ${nextAssignee.full_name}`;
  }

  if (duty.status === "grace") {
    return `Grace: чекає завершення -> ${nextAssignee.full_name}`;
  }

  if (duty.status === "overdue") {
    return `Прострочено -> ${nextAssignee.full_name}`;
  }

  if (duty.status === "handover_pending") {
    return `Очікує приймання -> ${nextAssignee.full_name}`;
  }

  return handoverLabel(duty, nextAssignee);
}

function handoverClassName(status: DutyPeriod["status"]) {
  if (status === "accepted") {
    return "border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-200";
  }

  if (status === "rejected") {
    return "border-red-300 bg-red-100 text-red-950 hover:bg-red-200";
  }

  if (status === "overdue") {
    return "border-red-300 bg-red-100 text-red-950 hover:bg-red-200";
  }

  return "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200";
}

function dutyForDay(duties: DutyPeriod[], dateKey: string) {
  return duties.find((duty) =>
    isWithinInterval(parseISO(dateKey), {
      start: parseISO(duty.week_start),
      end: parseISO(duty.week_end),
    }),
  );
}
