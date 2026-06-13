import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  deleteFutureScheduledDuties,
  getAppSettings,
  getNextRotationUser,
  insertDutyPeriod,
  listActiveRotationProfiles,
  previousDutyBefore,
  writeAuditLog,
} from "@/lib/data/store";
import { addDaysToDateKey, periodEndFromStart } from "@/lib/domain/dates";
import { badRequest, conflict, handleRouteError } from "@/lib/http";

const RegenerateScheduleSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periods: z.number().int().min(1).max(52).optional(),
  startWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weeks: z.number().int().min(1).max(52).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = RegenerateScheduleSchema.parse(await request.json());
    const settings = await getAppSettings();
    const startDate = body.startDate ?? body.startWeek;
    const requestedPeriods = body.periods ?? body.weeks ?? settings.future_schedule_weeks;

    const users = await listActiveRotationProfiles();

    if (users.length < 2) {
      throw conflict("At least two active users with rotation order are required");
    }

    if (!startDate) {
      throw badRequest("Start date is required");
    }

    if (body.endDate && body.endDate < startDate) {
      throw badRequest("End date must be on or after start date");
    }

    const previousDuty = await previousDutyBefore(startDate);
    await deleteFutureScheduledDuties(startDate);

    let assignee = previousDuty
      ? getNextRotationUser(users, previousDuty.assignee_id as string)
      : users[0];
    const rows = [];
    let periodStart = startDate;
    let index = 0;

    while (body.endDate ? periodStart <= body.endDate : index < requestedPeriods) {
      const calculatedPeriodEnd = periodEndFromStart(
        periodStart,
        settings.rotation_period_unit,
        settings.rotation_period_count,
      );
      const periodEnd =
        body.endDate && calculatedPeriodEnd > body.endDate
          ? body.endDate
          : calculatedPeriodEnd;
      const nextAssignee = getNextRotationUser(users, assignee.id);

      rows.push({
        assignee_id: assignee.id,
        next_assignee_id: nextAssignee.id,
        week_start: periodStart,
        week_end: periodEnd,
        status: "scheduled",
        created_by: admin.id,
      });

      assignee = nextAssignee;
      periodStart = addDaysToDateKey(periodEnd, 1);
      index += 1;

      if (index > 1000) {
        throw badRequest("Date range creates too many duty periods");
      }
    }

    for (const row of rows) {
      await insertDutyPeriod({
        assigneeId: row.assignee_id,
        nextAssigneeId: row.next_assignee_id,
        weekStart: row.week_start,
        weekEnd: row.week_end,
        status: "scheduled",
        createdBy: admin.id,
      });
    }

    await writeAuditLog({
      actorId: admin.id,
      action: "future_schedule_regenerated",
      entityType: "duty_period",
      payload: {
        startDate,
        endDate: body.endDate ?? null,
        periods: rows.length,
        rotationPeriodUnit: settings.rotation_period_unit,
        rotationPeriodCount: settings.rotation_period_count,
      },
    });

    return Response.json({ ok: true, created: rows.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
