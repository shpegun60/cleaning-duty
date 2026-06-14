import { SharedFilesManager } from "@/components/admin/shared-files-manager";
import { listSharedFiles } from "@/lib/data/store";
import type { SharedFile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage() {
  const files = (await listSharedFiles()) as SharedFile[];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Файли</h1>
        <p className="mt-1 text-stone-600">
          Спільні файли для користувачів. Адмін може додавати і видаляти, користувачі тільки переглядають.
        </p>
      </div>
      <SharedFilesManager files={files} />
    </div>
  );
}
