import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join, resolve } from "path";

import { getDataDir, readRuntimeConfig } from "@/lib/config/runtime";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { badRequest } from "@/lib/http";

export const SHARED_FILES_BUCKET = "shared-files";

export function sharedFileStoragePath(fileId: string, extension: string) {
  return `shared-files/${fileId}${extension}`;
}

export async function saveSharedFileObject(params: {
  storagePath: string;
  bytes: Buffer;
  contentType: string;
}) {
  if (readRuntimeConfig().backendMode === "supabase") {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage
      .from(SHARED_FILES_BUCKET)
      .upload(params.storagePath, params.bytes, {
        contentType: params.contentType,
        upsert: false,
      });

    if (error) throw error;
    return;
  }

  await mkdir(join(getDataDir(), "shared-files"), { recursive: true });
  await writeFile(safeDataPath(params.storagePath), params.bytes);
}

export async function loadSharedFileObject(storagePath: string) {
  if (readRuntimeConfig().backendMode === "supabase") {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(SHARED_FILES_BUCKET)
      .download(storagePath);

    if (error) throw error;

    return Buffer.from(await data.arrayBuffer());
  }

  return readFile(safeDataPath(storagePath));
}

export async function removeSharedFileObject(storagePath: string) {
  if (readRuntimeConfig().backendMode === "supabase") {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage
      .from(SHARED_FILES_BUCKET)
      .remove([storagePath]);

    if (error) throw error;
    return;
  }

  await unlink(safeDataPath(storagePath));
}

function safeDataPath(storagePath: string) {
  const dataDir = resolve(getDataDir());
  const fullPath = resolve(dataDir, storagePath);

  if (!fullPath.startsWith(`${dataDir}\\`) && !fullPath.startsWith(`${dataDir}/`)) {
    throw badRequest("Invalid file path");
  }

  return fullPath;
}
