import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  assertScheduleIsEmptyForRosterConfig,
  removeTask,
  writeAuditLog,
} from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const DeleteTaskSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = DeleteTaskSchema.parse(await request.json());
    await assertScheduleIsEmptyForRosterConfig();
    const result = await removeTask(body.id);

    await writeAuditLog({
      actorId: admin.id,
      action: "task_removed",
      entityType: "task",
      entityId: body.id,
      payload: { result },
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return handleRouteError(error);
  }
}
