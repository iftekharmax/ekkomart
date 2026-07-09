// Server functions for products (public read, admin CRUD).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const variationInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  attributes: z.record(z.string(), z.string()).default({}),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  cost_price: z.number().nullable().optional(),
  price: z.number().nonnegative().default(0),
  discount_price: z.number().nullable().optional(),
  stock: z.number().int().default(0),
  low_stock_alert: z.number().int().nullable().optional(),
  image_url: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  position: z.number().int().default(0),
});

const productInput = z.object({
  name: z.string().min(1),
  slug: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  unit: z.string().min(1),
  price: z.number().nonnegative(),
  old_price: z.number().nullable().optional(),
  cost_price: z.number().nullable().optional(),
  tax_percent: z.number().nullable().optional(),
  stock: z.number().int().nullable().optional(),
  low_stock_alert: z.number().int().nullable().optional(),
  product_type: z.enum(["simple", "variable"]).default("simple"),
  supplier_id: z.string().uuid().nullable().optional(),
  tag: z.string().nullable().optional(),
  img: z.string().nullable().optional(),
  category: z.string().min(1),
  subcategory: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  in_stock: z.boolean().default(true),
  images: z.array(z.string()).default([]),
  video_url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  specifications: z.record(z.string(), z.string()).default({}),
  weight_value: z.number().nullable().optional(),
  weight_unit: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  seo_title: z.string().nullable().optional(),
  seo_description: z.string().nullable().optional(),
  seo_keywords: z.array(z.string()).default([]),
  variations: z.array(variationInput).default([]),
});

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("products").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listVariations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { product_id: string }) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin.from("product_variations" as any) as any)
      .select("*").eq("product_id", data.product_id).order("position");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listAllVariations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin.from("product_variations" as any) as any)
      .select("id, product_id, name, stock, barcode, sku").order("position");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

function normalize(data: z.infer<typeof productInput>) {
  const out: Record<string, unknown> = { ...data };
  for (const k of ["slug", "sku", "barcode", "brand", "tag", "img", "subcategory", "video_url", "description", "seo_title", "seo_description", "weight_unit", "supplier_id"]) {
    if (out[k] === "" || out[k] === undefined) out[k] = null;
  }
  if (Array.isArray(out.images) && (out.images as string[])[0] && !out.img) {
    out.img = (out.images as string[])[0];
  }
  delete out.variations;
  return out;
}

async function syncVariations(supabase: any, productId: string, variations: z.infer<typeof variationInput>[]) {
  const client: any = supabase.from("product_variations" as any);
  const { data: existing } = await client.select("id").eq("product_id", productId);
  const existingIds = new Set(((existing ?? []) as any[]).map((r) => r.id));
  const incomingIds = new Set(variations.filter((v) => v.id).map((v) => v.id!));
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toDelete.length) {
    const { error } = await client.delete().in("id", toDelete);
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < variations.length; i++) {
    const v = { ...variations[i], position: i, product_id: productId };
    if (v.id) {
      const { id, ...rest } = v;
      const { error } = await client.update(rest).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { id: _drop, ...rest } = v as any;
      const { error } = await client.insert(rest);
      if (error) throw new Error(error.message);
    }
  }
}

export const createProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof productInput>) => productInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const variations = data.variations ?? [];
    const payload = normalize(data);
    const { data: row, error } = await supabaseAdmin.from("products").insert(payload as any).select().single();
    if (error) throw new Error(error.message);
    if (data.product_type === "variable" && row?.id) await syncVariations(supabaseAdmin, row.id, variations);
    return row;
  });

const productUpdate = productInput.partial().extend({ id: z.string().uuid() });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof productUpdate>) => productUpdate.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...rest } = data;
    const variations = rest.variations;
    const payload = normalize(rest as z.infer<typeof productInput>);
    const { data: row, error } = await supabaseAdmin.from("products").update(payload as any).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    if (variations !== undefined) await syncVariations(supabaseAdmin, id, variations);
    return row;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
