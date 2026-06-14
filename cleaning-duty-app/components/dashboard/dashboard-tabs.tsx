"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { ScheduleCalendar } from "@/components/admin/schedule-calendar";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AssigneeChange, DutyPeriod, Profile, SharedFile } from "@/lib/types";

type DashboardTab = "duties" | "calendar" | "files";

export function DashboardTabs({
  duties,
  user,
  calendarDuties,
  profiles,
  changes,
  files,
  month,
  viewStart,
  viewEnd,
  isCustomRange,
  initialTab,
  gracePeriodDays,
  localDate,
}: {
  duties: DutyPeriod[];
  user: Profile;
  calendarDuties: DutyPeriod[];
  profiles: Profile[];
  changes: AssigneeChange[];
  files: SharedFile[];
  month: string;
  viewStart: string;
  viewEnd: string;
  isCustomRange: boolean;
  initialTab: DashboardTab;
  gracePeriodDays: number;
  localDate: string;
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "duties"} onClick={() => setActiveTab("duties")}>
          Події
        </TabButton>
        <TabButton active={activeTab === "calendar"} onClick={() => setActiveTab("calendar")}>
          Календар
        </TabButton>
        <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>
          Файли
        </TabButton>
      </div>

      {activeTab === "duties" ? (
        <DutyList
          duties={duties}
          user={user}
          localDate={localDate}
          gracePeriodDays={gracePeriodDays}
        />
      ) : null}
      {activeTab === "calendar" ? (
        <ScheduleCalendar
          duties={calendarDuties}
          profiles={profiles}
          month={month}
          viewStart={viewStart}
          viewEnd={viewEnd}
          isCustomRange={isCustomRange}
          changes={changes}
          readOnly
          viewerUserId={user.id}
          pagePath="/dashboard"
          extraQuery={{ tab: "calendar" }}
          gracePeriodDays={gracePeriodDays}
        />
      ) : null}
      {activeTab === "files" ? <SharedFilesList files={files} /> : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rounded-md border px-3 py-2 text-sm font-semibold ${
        active
          ? "border-emerald-700 bg-emerald-700 text-white"
          : "border-stone-300 bg-white text-stone-900 hover:bg-stone-100"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DutyList({
  duties,
  user,
  localDate,
  gracePeriodDays,
}: {
  duties: DutyPeriod[];
  user: Profile;
  localDate: string;
  gracePeriodDays: number;
}) {
  return (
    <div className="grid gap-3">
      {duties.map((duty) => {
        const isOwnDuty = duty.assignee_id === user.id;
        const canEditOwnDuty =
          isOwnDuty && canWorkerEditDuty(duty, localDate, gracePeriodDays);
        const dutyHint = isOwnDuty
          ? dashboardDutyRestrictionHint(duty, localDate, gracePeriodDays)
          : null;

        return (
          <section key={duty.id} className="rounded-md border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {duty.week_start} - {duty.week_end}
                </p>
                <div className="mt-2">
                  <StatusBadge status={duty.status} />
                </div>
                {dutyHint ? <p className="mt-2 max-w-xl text-sm text-stone-600">{dutyHint}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {isOwnDuty ? (
                  <Link
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                      canEditOwnDuty
                        ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                    }`}
                    href={`/duty/${duty.id}`}
                  >
                    {canEditOwnDuty ? "Роботи" : "Переглянути"}
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
        );
      })}
      {duties.length === 0 ? (
        <section className="rounded-md border border-stone-200 bg-white p-6 text-stone-600">
          Активних або майбутніх чергувань для тебе поки немає.
        </section>
      ) : null}
    </div>
  );
}

function canWorkerEditDuty(
  duty: Pick<DutyPeriod, "status" | "week_start" | "week_end">,
  localDate: string,
  gracePeriodDays: number,
) {
  return (
    (duty.status === "active" || duty.status === "grace") &&
    isDateInDutyWorkWindow(duty, localDate, gracePeriodDays)
  );
}

function dashboardDutyRestrictionHint(
  duty: Pick<DutyPeriod, "status" | "week_start" | "week_end">,
  localDate: string,
  gracePeriodDays: number,
) {
  if (canWorkerEditDuty(duty, localDate, gracePeriodDays)) {
    return null;
  }

  if (duty.status === "scheduled") {
    return "Чергування ще не активне або очікує завершення попереднього періоду.";
  }

  if (!isDateInDutyWorkWindow(duty, localDate, gracePeriodDays)) {
    return "Галочки доступні тільки у діапазоні чергування або під час grace period.";
  }

  if (duty.status === "cleaning_done" || duty.status === "handover_pending") {
    return "Прибирання вже передане на приймання, тому галочки заблоковані.";
  }

  if (duty.status === "accepted") {
    return "Чергування вже прийняте.";
  }

  if (duty.status === "overdue" || duty.status === "force_closed" || duty.status === "cancelled") {
    return "Період вже закритий.";
  }

  if (duty.status === "rejected" || duty.status === "ready_for_recheck") {
    return "Період у статусі перевірки або відмови, тому галочки заблоковані.";
  }

  return "Для цього статусу галочки недоступні.";
}

function isDateInDutyWorkWindow(
  duty: Pick<DutyPeriod, "week_start" | "week_end">,
  localDate: string,
  gracePeriodDays: number,
) {
  if (duty.week_start <= localDate && duty.week_end >= localDate) {
    return true;
  }

  if (gracePeriodDays <= 0 || duty.week_end >= localDate) {
    return false;
  }

  return addDaysToDateKey(duty.week_end, gracePeriodDays) >= localDate;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function SharedFilesList({ files }: { files: SharedFile[] }) {
  return (
    <div className="grid gap-3">
      {files.map((file) => (
        <section key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white p-4">
          <div>
            <p className="font-semibold">{file.original_name}</p>
            <p className="text-sm text-stone-600">
              {formatFileSize(file.size_bytes)} · {new Date(file.created_at).toLocaleString()}
            </p>
          </div>
          <a
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-100"
            href={`/api/files/${file.id}`}
          >
            Відкрити
          </a>
        </section>
      ))}
      {files.length === 0 ? (
        <section className="rounded-md border border-stone-200 bg-white p-6 text-stone-600">
          Файлів поки немає.
        </section>
      ) : null}
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}
