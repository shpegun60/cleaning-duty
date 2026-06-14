import { unlink } from "fs/promises";
import { resolve } from "path";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/guards";
import { getDataDir } from "@/lib/config/runtime";
import { removeSharedFile, writeAuditLog } from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";

const DeleteSharedFileSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = DeleteSharedFileSchema.parse(await request.json());
    const file = await removeSharedFile(body.id);

    await unlink(safeDataPath(file.storage_path)).catch(() => undefined);
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

function safeDataPath(storagePath: string) {
  const dataDir = resolve(getDataDir());
  const fullPath = resolve(dataDir, storagePath);

  if (!fullPath.startsWith(`${dataDir}\\`) && !fullPath.startsWith(`${dataDir}/`)) {
    throw badRequest("Invalid file path");
  }

  return fullPath;
}
