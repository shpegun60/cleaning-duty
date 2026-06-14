import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import {
  assertScheduleIsEmptyForRosterConfig,
  removeProfile,
  writeAuditLog,
} from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const DeleteUserSchema = z.object({
  userId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = DeleteUserSchema.parse(await request.json());
    await assertScheduleIsEmptyForRosterConfig();
    const result = await removeProfile(body.userId);

    await writeAuditLog({
      actorId: admin.id,
      action: "profile_removed",
      entityType: "profile",
      entityId: body.userId,
      payload: { result },
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return handleRouteError(error);
  }
}
