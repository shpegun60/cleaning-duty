import { requireUser } from "@/lib/auth/guards";
import { loadSharedFile } from "@/lib/data/store";
import { handleRouteError } from "@/lib/http";
import { loadSharedFileObject } from "@/lib/storage/shared-files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    await requireUser();
    const { fileId } = await params;
    const file = await loadSharedFile(fileId);
    const bytes = await loadSharedFileObject(file.storage_path);

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

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\w .-]/g, "_").replace(/"/g, "");
  return `attachment; filename="${fallback || "file"}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
