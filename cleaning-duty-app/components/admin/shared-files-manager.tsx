"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { SharedFile } from "@/lib/types";

export function SharedFilesManager({ files }: { files: SharedFile[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setMessage(null);
    setBusy(true);

    try {
      const response = await fetch("/api/admin/files", {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }

      formElement.reset();
      setMessage("Файл додано");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setBusy(false);
    }
  }

  async function removeFile(file: SharedFile) {
    if (!window.confirm(`Видалити ${file.original_name}?`)) {
      return;
    }

    setMessage(null);
    setBusy(true);

    try {
      const response = await fetch("/api/admin/files/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: file.id }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }

      setMessage("Файл видалено");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Помилка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <form onSubmit={upload} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4">
        <h2 className="font-semibold">Додати файл</h2>
        <input
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
          name="file"
          type="file"
          required
          disabled={busy}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          Завантажити
        </Button>
      </form>

      <div className="grid gap-3">
        {files.map((file) => (
          <section key={file.id} className="grid gap-3 rounded-md border border-stone-200 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="font-semibold">{file.original_name}</p>
              <p className="text-sm text-stone-600">
                {formatFileSize(file.size_bytes)} · {new Date(file.created_at).toLocaleString()}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-stone-100"
                href={`/api/files/${file.id}`}
              >
                Відкрити
              </a>
              <Button type="button" variant="danger" onClick={() => removeFile(file)} disabled={busy}>
                Видалити
              </Button>
            </div>
          </section>
        ))}
        {files.length === 0 ? (
          <section className="rounded-md border border-stone-200 bg-white p-6 text-stone-600">
            Файлів поки немає.
          </section>
        ) : null}
      </div>

      {message ? <p className="text-sm text-stone-700">{message}</p> : null}
    </div>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}
