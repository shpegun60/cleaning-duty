import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  revertAssigneeChange,
  syncHandoverLinksAroundDuty,
  writeAuditLog,
} from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const RevertAssigneeChangeSchema = z.object({
  changeId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = RevertAssigneeChangeSchema.parse(await request.json());
    const change = await revertAssigneeChange(body.changeId, admin.id);
    await syncHandoverLinksAroundDuty(change.duty_period_id);

    await writeAuditLog({
      actorId: admin.id,
      action: "assignee_change_reverted",
      entityType: "assignee_change",
      entityId: change.id,
      payload: {
        dutyPeriodId: change.duty_period_id,
        restoredAssigneeId: change.previous_assignee_id,
        restoredNextAssigneeId: change.previous_next_assignee_id,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
