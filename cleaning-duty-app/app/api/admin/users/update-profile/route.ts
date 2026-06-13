import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { updateProfile, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";

const UpdateProfileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().nullable(),
  isActive: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = UpdateProfileSchema.parse(await request.json());
    await updateProfile(body);

    await writeAuditLog({
      actorId: admin.id,
      action: "profile_updated",
      entityType: "profile",
      entityId: body.userId,
      payload: body,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
