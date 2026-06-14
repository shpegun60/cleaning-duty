import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { requireUserPage } from "@/lib/auth/page-guards";
import {
  listActiveAssigneeChangesForDuties,
  getAppSettings,
  listDutiesForUser,
  listDutiesInRange,
  listProfiles,
  listSharedFiles,
} from "@/lib/data/store";
import { scheduleViewRange } from "@/lib/domain/schedule-calendar";
import type { AppSettings, AssigneeChange, DutyPeriod, Profile, SharedFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    tab?: string | string[];
    month?: string | string[];
    start?: string | string[];
    end?: string | string[];
  }>;
}) {
  const user = await requireUserPage();
  const params = await searchParams;
  const range = scheduleViewRange({
    month: params?.month,
    start: params?.start,
    end: params?.end,
  });
  const [duties, calendarDuties, profiles, files, settings] = (await Promise.all([
    listDutiesForUser(user.id),
    listDutiesInRange(range.gridStart, range.gridEnd),
    listProfiles(),
    listSharedFiles(),
    getAppSettings(),
  ])) as [DutyPeriod[], DutyPeriod[], Profile[], SharedFile[], AppSettings];
  const changes = (await listActiveAssigneeChangesForDuties(
    calendarDuties.map((duty) => duty.id),
  )) as AssigneeChange[];
  const publicProfiles = profiles.map((profile) => ({
    id: profile.id,
    email: "",
    full_name: profile.full_name,
    role: profile.role,
    rotation_order: profile.rotation_order,
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
  }));
  const tab = normalizeDashboardTab(params?.tab);

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Моє чергування</h1>
          <p className="mt-1 text-stone-600">
            Тут показано твої події, загальний календар чергувань і файли від адміна.
          </p>
        </div>
        {user.role === "admin" ? <ButtonLink href="/admin">Адмінка</ButtonLink> : null}
      </div>

      <DashboardTabs
        duties={duties}
        user={user}
        calendarDuties={calendarDuties}
        profiles={publicProfiles}
        changes={changes}
        files={files}
        month={range.month}
        viewStart={range.start ?? range.gridStart}
        viewEnd={range.end ?? range.gridEnd}
        isCustomRange={range.mode === "range"}
        initialTab={tab}
        gracePeriodDays={settings.grace_period_days}
      />
    </AppShell>
  );
}

function normalizeDashboardTab(value: string | string[] | undefined) {
  const tab = Array.isArray(value) ? value[0] : value;

  if (tab === "calendar" || tab === "files") {
    return tab;
  }

  return "duties";
}
