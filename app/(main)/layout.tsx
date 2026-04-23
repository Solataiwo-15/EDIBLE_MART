import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MainNav from "@/components/layout/MainNav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, is_admin")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MainNav
        userName={profile?.full_name ?? ""}
        isAdmin={profile?.is_admin ?? false}
      />

      <main className="flex-1 pt-16 pb-20 md:pb-6">{children}</main>
    </div>
  );
}
