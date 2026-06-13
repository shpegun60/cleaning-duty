import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { writeAuditLog } from "@/lib/domain/audit";
import { handleRouteError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const InviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(2),
  role: z.enum(["admin", "worker"]),
  rotationOrder: z.number().int().nullable(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = InviteUserSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { data: inviteData, error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(body.email);

    if (inviteError) {
      throw inviteError;
    }

    const userId = inviteData.user?.id;

    if (!userId) {
      throw new Error("Invite did not return user id");
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      email: body.email,
      full_name: body.fullName,
      role: body.role,
      rotation_order: body.rotationOrder,
      is_active: true,
    });

    if (profileError) {
      throw profileError;
    }

    await writeAuditLog(supabase, {
      actorId: admin.id,
      action: "user_invited",
      entityType: "profile",
      entityId: userId,
      payload: body,
    });

    return Response.json({ ok: true, userId });
  } catch (error) {
    return handleRouteError(error);
  }
}
