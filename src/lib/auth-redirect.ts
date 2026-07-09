import { supabase } from "@/integrations/supabase/client";

export async function getPostLoginPath(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "/auth";
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  return isAdmin ? "/admin" : "/profile";
}
