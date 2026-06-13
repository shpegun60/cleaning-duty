import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  deleteFutureScheduledDuties,
  getNextRotationUser,
  insertDutyPeriod,
  listActiveRotationProfiles,
  previousDutyBefore,
  writeAuditLog,
} from "@/lib/data/store";
import { badRequest, conflict, handleRouteError } from "@/lib/http";

const RegenerateScheduleSchema = z.object({
  startWeek: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks: z.number().int().min(1).max(52),
});

function isMonday(dateKey: string) {
  return parseISO(dateKey).getDay() === 1;
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = RegenerateScheduleSchema.parse(await request.json());

    if (!isMonday(body.startWeek)) {
      throw badRequest("startWeek must be a Monday");
    }

    const users = await listActiveRotationProfiles();

    if (users.length < 2) {
      throw conflict("At least two active users with rotation order are required");
    }

    const previousDuty = await previousDutyBefore(body.startWeek);
    await deleteFutureScheduledDuties(body.startWeek);

    let assignee = previousDuty
      ? getNextRotationUser(users, previousDuty.assignee_id as string)
      : users[0];
    const rows = [];

    for (let index = 0; index < body.weeks; index += 1) {
      const weekStart = format(addDays(parseISO(body.startWeek), index * 7), "yyyy-MM-dd");
      const weekEnd = format(addDays(parseISO(weekStart), 6), "yyyy-MM-dd");
      const nextAssignee = getNextRotationUser(users, assignee.id);

      rows.push({
        assignee_id: assignee.id,
        next_assignee_id: nextAssignee.id,
        week_start: weekStart,
        week_end: weekEnd,
        status: "scheduled",
        created_by: admin.id,
      });

      assignee = nextAssignee;
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
      payload: body,
    });

    return Response.json({ ok: true, created: rows.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
