import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";

export default async function AdminLayout({
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

  // Block non-admins entirely
  if (!profile?.is_admin) redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <AdminNav userName={profile.full_name} />
      <div className="pt-16 md:pl-56">
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </div>
  );
}
