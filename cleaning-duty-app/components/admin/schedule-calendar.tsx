import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { StatusBadge } from "@/components/ui/status-badge";
import type { DutyPeriod, Profile } from "@/lib/types";

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

export function ScheduleCalendar({
  duties,
  profiles,
  month,
}: {
  duties: DutyPeriod[];
  profiles: Profile[];
  month: string;
}) {
  const monthDate = parseMonth(month);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const profileIndexMap = new Map(
    profiles.map((profile, index) => [profile.id, index]),
  );
  const previousMonth = format(addMonths(monthDate, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const todayKey = format(new Date(), "yyyy-MM-dd");

  return (
    <section className="rounded-md border border-stone-200 bg-white p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Календар чергувань</h2>
          <p className="text-sm text-stone-600">
            Діапазон показує, хто чергує. Останній день діапазону позначений як день передачі.
          </p>
        </div>
        <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
          <Link
            className="flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white text-lg font-semibold hover:bg-stone-100"
            href={`/admin/schedule?month=${previousMonth}`}
            aria-label="Попередній місяць"
          >
            ‹
          </Link>
          <span className="min-w-40 text-center font-semibold">
            {monthLabels[monthDate.getMonth()]} {format(monthDate, "yyyy")}
          </span>
          <Link
            className="flex h-10 items-center justify-center rounded-md border border-stone-300 bg-white text-lg font-semibold hover:bg-stone-100"
            href={`/admin/schedule?month=${nextMonth}`}
            aria-label="Наступний місяць"
          >
            ›
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[780px] grid-cols-7 rounded-md border border-stone-200">
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
            const nextAssignee = duty?.next_assignee_id
              ? profileMap.get(duty.next_assignee_id)
              : null;
            const assignee = duty ? profileMap.get(duty.assignee_id) : null;
            const isCurrentMonth = day >= monthStart && day <= monthEnd;
            const isHandoverDay = duty?.week_end === dateKey;
            const style = duty
              ? dutyStyles[(profileIndexMap.get(duty.assignee_id) ?? 0) % dutyStyles.length]
              : "";

            return (
              <div
                key={dateKey}
                className={`min-h-32 border-b border-r border-stone-200 p-2 ${
                  isCurrentMonth ? "bg-white" : "bg-stone-50 text-stone-400"
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
                  <Link
                    href={`/duty/${duty.id}`}
                    className={`block rounded-md border px-2 py-1.5 text-xs ${style}`}
                  >
                    <span className="block truncate font-semibold">
                      {assignee?.full_name ?? duty.assignee_id}
                    </span>
                    <span className="block truncate opacity-80">
                      {duty.week_start} - {duty.week_end}
                    </span>
                  </Link>
                ) : null}
                {isHandoverDay ? (
                  <div className="mt-2 truncate rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-950">
                    Передача{nextAssignee ? ` -> ${nextAssignee.full_name}` : ""}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function scheduleCalendarRange(month: string) {
  const monthDate = parseMonth(month);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  return {
    gridStart: format(startOfWeek(monthStart, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    gridEnd: format(endOfWeek(monthEnd, { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

export function currentScheduleMonth() {
  return format(new Date(), "yyyy-MM");
}

export function normalizeScheduleMonth(value: string | string[] | undefined) {
  const month = Array.isArray(value) ? value[0] : value;
  return month && /^\d{4}-\d{2}$/.test(month) ? month : currentScheduleMonth();
}

function parseMonth(month: string) {
  return parseISO(`${month}-01`);
}

function dutyForDay(duties: DutyPeriod[], dateKey: string) {
  return duties.find((duty) =>
    isWithinInterval(parseISO(dateKey), {
      start: parseISO(duty.week_start),
      end: parseISO(duty.week_end),
    }),
  );
}
