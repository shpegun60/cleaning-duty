import { redirect } from "next/navigation";

import { requireAdmin, requireUser } from "@/lib/auth/guards";

export async function requireUserPage() {
  try {
    return await requireUser();
  } catch {
    redirect("/login");
  }
}

export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch {
    redirect("/dashboard");
  }
}
