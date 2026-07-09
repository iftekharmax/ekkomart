// Server functions for brands, units, attributes.
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
    .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/* ---------------- Brands ---------------- */
const brandInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
});
export const listBrands = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("brands").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});
export const createBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof brandInput>) => brandInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("brands").insert(data as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const updateBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof brandInput> & { id: string }) =>
    brandInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase.from("brands").update(rest as any).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const deleteBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("brands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Units ---------------- */
const unitInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  symbol: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});
export const listUnits = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("units").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});
export const createUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof unitInput>) => unitInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("units").insert(data as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const updateUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof unitInput> & { id: string }) =>
    unitInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase.from("units").update(rest as any).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("units").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Attributes ---------------- */
const attrInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  values: z.array(z.string()).default([]),
});
export const listAttributes = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await publicClient().from("attributes").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});
export const createAttribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof attrInput>) => attrInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("attributes").insert(data as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const updateAttribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof attrInput> & { id: string }) =>
    attrInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { data: row, error } = await context.supabase.from("attributes").update(rest as any).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const deleteAttribute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("attributes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Suppliers ---------------- */
const supplierInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  contact_name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image_url: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
});
export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase.from("suppliers" as any) as any).select("*").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });
export const createSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof supplierInput>) => supplierInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase.from("suppliers" as any) as any).insert(data as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const updateSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof supplierInput> & { id: string }) =>
    supplierInput.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const { data: row, error } = await (context.supabase.from("suppliers" as any) as any).update(rest as any).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });
export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("suppliers" as any) as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

