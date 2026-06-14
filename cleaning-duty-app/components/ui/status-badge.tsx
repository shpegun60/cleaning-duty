import { clsx } from "clsx";

const labels: Record<string, string> = {
  scheduled: "Заплановано",
  active: "Активне",
  grace: "Grace period",
  cleaning_done: "Прибрано",
  handover_pending: "Очікує приймання",
  accepted: "Прийнято",
  rejected: "Відхилено",
  ready_for_recheck: "Готово до перевірки",
  force_closed: "Закрито",
  overdue: "Прострочено",
  cancelled: "Скасовано",
  pending: "Очікує",
  sent: "Надіслано",
  failed: "Помилка",
  skipped: "Пропущено",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex max-w-full items-center justify-center rounded-md px-2 py-1 text-center text-xs font-semibold leading-tight whitespace-normal [overflow-wrap:anywhere]",
        ["active", "sent", "accepted"].includes(status) &&
          "bg-emerald-100 text-emerald-800",
        ["rejected", "failed", "overdue"].includes(status) && "bg-red-100 text-red-800",
        ["handover_pending", "ready_for_recheck", "cleaning_done", "pending", "grace"].includes(
          status,
        ) && "bg-amber-100 text-amber-800",
        ["scheduled", "skipped"].includes(status) && "bg-stone-200 text-stone-800",
        ["cancelled", "force_closed"].includes(status) && "bg-zinc-200 text-zinc-700",
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
