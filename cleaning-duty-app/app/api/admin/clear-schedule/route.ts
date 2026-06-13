import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { clearDutySchedule, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const ClearScheduleSchema = z.object({
  confirm: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    ClearScheduleSchema.parse(await request.json());

    const deletedCount = await clearDutySchedule();

    await writeAuditLog({
      actorId: admin.id,
      action: "schedule_cleared",
      entityType: "duty_period",
      payload: { deletedCount },
    });

    return Response.json({ ok: true, deletedCount });
  } catch (error) {
    return handleRouteError(error);
  }
}
