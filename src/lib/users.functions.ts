// Admin-only: full user management (list, create, update, delete, roles).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (!data || data.length === 0) throw new Error("Forbidden");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers();
    if (usersErr) throw new Error(usersErr.message);
    const users = usersData.users;
    const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      profile: profiles?.find((p) => p.id === u.id) ?? null,
      roles: roles?.filter((r) => r.user_id === u.id).map((r) => r.role) ?? [],
    }));
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return (data ?? []).map((r: { role: string }) => r.role);
  });

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().optional(),
  role: z.enum(["admin", "user"]).default("user"),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof createSchema>) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name ?? "" },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // handle_new_user trigger seeds profile + default role; ensure requested role
    if (data.role === "admin") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: uid, role: "admin" },
        { onConflict: "user_id,role" },
      );
    }
    return { ok: true, id: uid };
  });

const updateSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  full_name: z.string().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof updateSchema>) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const attrs: Record<string, unknown> = {};
    if (data.email) attrs.email = data.email;
    if (data.password) attrs.password = data.password;
    if (Object.keys(attrs).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, attrs);
      if (error) throw new Error(error.message);
    }
    if (data.full_name !== undefined) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.full_name })
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "user" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "user" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.role === "admin" && data.userId === context.userId) {
      throw new Error("You cannot remove your own admin role");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
