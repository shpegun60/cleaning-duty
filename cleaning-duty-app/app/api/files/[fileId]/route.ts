import { readFile } from "fs/promises";
import { resolve } from "path";

import { requireUser } from "@/lib/auth/guards";
import { getDataDir } from "@/lib/config/runtime";
import { loadSharedFile } from "@/lib/data/store";
import { badRequest, handleRouteError } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    await requireUser();
    const { fileId } = await params;
    const file = await loadSharedFile(fileId);
    const bytes = await readFile(safeDataPath(file.storage_path));

    return new Response(bytes, {
      headers: {
        "content-type": file.mime_type || "application/octet-stream",
        "content-length": String(file.size_bytes),
        "content-disposition": contentDisposition(file.original_name),
      },
    });
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

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\w .-]/g, "_").replace(/"/g, "");
  return `attachment; filename="${fallback || "file"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
