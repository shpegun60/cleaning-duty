import { AppShell } from "@/components/layout/app-shell";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUserPage } from "@/lib/auth/page-guards";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUserPage();

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Мій профіль</h1>
        <p className="mt-1 text-stone-600">
          Тут можна змінити свій email, ім&apos;я і пароль для входу.
        </p>
      </div>

      <ProfileForm profile={user} />
    </AppShell>
  );
}
