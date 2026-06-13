import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { getRotationUsers, getNextRotationUser } from "@/lib/domain/rotation";
import { badRequest, conflict, handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

    const supabase = createSupabaseAdminClient();
    const users = await getRotationUsers(supabase);

    if (users.length < 2) {
      throw conflict("At least two active users with rotation order are required");
    }

    const { data: previousDuty, error: previousError } = await supabase
      .from("duty_periods")
      .select("assignee_id")
      .lt("week_start", body.startWeek)
      .neq("status", "cancelled")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousError) {
      throw previousError;
    }

    const { error: deleteError } = await supabase
      .from("duty_periods")
      .delete()
      .eq("status", "scheduled")
      .gte("week_start", body.startWeek);

    if (deleteError) {
      throw deleteError;
    }

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

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from("duty_periods").insert(rows);

      if (insertError) {
        throw insertError;
      }
    }

    await writeAuditLog(supabase, {
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
