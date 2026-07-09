// Server functions for categories + subcategories.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}


/* ---------------- Categories ---------------- */

const categoryInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),
});

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("categories").select("*").order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof categoryInput>) => categoryInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("categories").insert(data as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof categoryInput> & { id: string }) =>
    categoryInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase.from("categories").update(rest as any).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Subcategories ---------------- */

const subInput = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  sort_order: z.number().int().default(0),

});

export const listSubcategories = createServerFn({ method: "GET" })
  .inputValidator((d: { category_id?: string } | undefined) =>
    z.object({ category_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const sb = publicClient();
    let q = sb.from("subcategories").select("*").order("sort_order").order("name");
    if (data.category_id) q = q.eq("category_id", data.category_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createSubcategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof subInput>) => subInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("subcategories").insert(data as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateSubcategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof subInput> & { id: string }) =>
    subInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase.from("subcategories").update(rest as any).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSubcategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("subcategories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
