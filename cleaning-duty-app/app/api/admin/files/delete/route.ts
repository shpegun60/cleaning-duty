import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { loadSharedFile, removeSharedFile, writeAuditLog } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";
import { removeSharedFileObject } from "@/lib/storage/shared-files";

const DeleteSharedFileSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = DeleteSharedFileSchema.parse(await request.json());
    const file = await loadSharedFile(body.id);

    await removeSharedFileObject(file.storage_path).catch(() => undefined);
    await removeSharedFile(body.id);
    await writeAuditLog({
      actorId: admin.id,
      action: "shared_file_removed",
      entityType: "shared_file",
      entityId: file.id,
      payload: {
        originalName: file.original_name,
        sizeBytes: file.size_bytes,
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
