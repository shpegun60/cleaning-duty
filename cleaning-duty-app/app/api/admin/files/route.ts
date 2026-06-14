import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { extname, join, resolve } from "path";

import { requireAdmin } from "@/lib/auth/guards";
import { getDataDir } from "@/lib/config/runtime";
import { createSharedFile, writeAuditLog } from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  let savedPath: string | null = null;

  try {
    const admin = await requireAdmin();
    const form = await request.formData();
    const value = form.get("file");

    if (!(value instanceof File)) {
      throw badRequest("File is required");
    }

    if (value.size <= 0) {
      throw badRequest("File is empty");
    }

    if (value.size > MAX_FILE_BYTES) {
      throw badRequest("File is too large. Max size is 20 MB.");
    }

    const id = randomUUID();
    const extension = safeExtension(value.name);
    const storagePath = `shared-files/${id}${extension}`;
    const fullPath = safeDataPath(storagePath);
    savedPath = fullPath;

    await mkdir(join(getDataDir(), "shared-files"), { recursive: true });
    await writeFile(fullPath, Buffer.from(await value.arrayBuffer()));
    await createSharedFile({
      id,
      originalName: value.name || "file",
      mimeType: value.type || "application/octet-stream",
      sizeBytes: value.size,
      storagePath,
      uploadedBy: admin.id,
    });

    await writeAuditLog({
      actorId: admin.id,
      action: "shared_file_uploaded",
      entityType: "shared_file",
      entityId: id,
      payload: {
        originalName: value.name,
        mimeType: value.type,
        sizeBytes: value.size,
      },
    });

    return Response.json({ ok: true, id });
  } catch (error) {
    if (savedPath) {
      await unlink(savedPath).catch(() => undefined);
    }
    return handleRouteError(error);
  }
}

function safeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return /^[a-z0-9.]{1,16}$/.test(extension) ? extension : "";
}

function safeDataPath(storagePath: string) {
  const dataDir = resolve(getDataDir());
  const fullPath = resolve(dataDir, storagePath);

  if (!fullPath.startsWith(`${dataDir}\\`) && !fullPath.startsWith(`${dataDir}/`)) {
    throw badRequest("Invalid file path");
  }

  return fullPath;
}
