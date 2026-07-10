import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { mapPosSearchRows } from "./pos-search";

type AdminContext = { supabase: any; userId: string };

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export async function assertAdmin(context: AdminContext) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

const productSelect = "id,name,sku,barcode,price,stock,img,unit,product_type, product_variations(id,name,sku,barcode,price,stock,image_url,is_active,position)";

export async function searchPosProducts(data: { q?: string; limit?: number }) {
  const sb = publicClient();
  const q = (data.q ?? "").trim();
  const limit = Math.min(Math.max(Number(data.limit) || 24, 1), 60);

  if (!q) {
    const { data: rows, error } = await sb.from("products").select(productSelect).order("name").limit(limit);
    if (error) throw new Error(error.message);
    return mapPosSearchRows((rows ?? []) as any[], q, limit);
  }

  const pattern = `%${q}%`;
  const productIdQueries = await Promise.all([
    sb.from("products").select("id").ilike("name", pattern).limit(limit),
    sb.from("products").select("id").ilike("sku", pattern).limit(limit),
    sb.from("products").select("id").ilike("barcode", pattern).limit(limit),
    (sb.from("product_variations" as any) as any).select("product_id").ilike("name", pattern).limit(limit),
    (sb.from("product_variations" as any) as any).select("product_id").ilike("sku", pattern).limit(limit),
    (sb.from("product_variations" as any) as any).select("product_id").ilike("barcode", pattern).limit(limit),
  ]);

  for (const result of productIdQueries) {
    if (result.error) throw new Error(result.error.message);
  }

  const productIds = new Set<string>();
  for (const result of productIdQueries) {
    for (const row of (result.data ?? []) as any[]) {
      if (row.id) productIds.add(row.id);
      if (row.product_id) productIds.add(row.product_id);
    }
  }
  if (productIds.size === 0) return [];

  const { data: rows, error } = await sb
    .from("products")
    .select(productSelect)
    .in("id", Array.from(productIds))
    .limit(Math.max(limit * 3, limit));
  if (error) throw new Error(error.message);

  return mapPosSearchRows((rows ?? []) as any[], q, limit);
}