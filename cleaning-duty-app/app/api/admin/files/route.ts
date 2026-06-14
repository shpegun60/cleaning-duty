import { randomUUID } from "crypto";
import { extname } from "path";

import { requireAdmin } from "@/lib/auth/guards";
import { createSharedFile, writeAuditLog } from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";
import {
  removeSharedFileObject,
  saveSharedFileObject,
  sharedFileStoragePath,
} from "@/lib/storage/shared-files";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  let savedStoragePath: string | null = null;

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
    const storagePath = sharedFileStoragePath(id, extension);
    savedStoragePath = storagePath;
    const mimeType = value.type || "application/octet-stream";

    await saveSharedFileObject({
      storagePath,
      bytes: Buffer.from(await value.arrayBuffer()),
      contentType: mimeType,
    });
    await createSharedFile({
      id,
      originalName: value.name || "file",
      mimeType,
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
    if (savedStoragePath) {
      await removeSharedFileObject(savedStoragePath).catch(() => undefined);
    }
    return handleRouteError(error);
  }
}

function safeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return /^[a-z0-9.]{1,16}$/.test(extension) ? extension : "";
}
