// POS server functions — product search + sale creation reusing orders/order_items.
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

export const posSearchProducts = createServerFn({ method: "GET" })
  .inputValidator((d: { q?: string; limit?: number }) =>
    z.object({ q: z.string().optional().default(""), limit: z.number().int().min(1).max(60).optional().default(24) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const q = (data.q ?? "").trim();
    let query = sb.from("products").select("id,name,sku,barcode,price,stock,img,unit").order("name").limit(data.limit);
    if (q) {
      // barcode / sku exact-ish first, then name ilike
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const saleInput = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    name: z.string().min(1),
    price: z.number().nonnegative(),
    qty: z.number().int().min(1),
    img: z.string().nullable().optional(),
  })).min(1),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  paid: z.number().nonnegative().default(0),
  payment_method: z.enum(["cash", "card", "mobile", "other"]).default("cash"),
  customer: z.string().optional().nullable(),
});

export const createPosSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof saleInput>) => saleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const subtotal = data.items.reduce((s, it) => s + it.price * it.qty, 0);
    const total = Math.max(0, subtotal - data.discount + data.tax);

    const note = JSON.stringify({
      pos: true,
      subtotal, discount: data.discount, tax: data.tax, paid: data.paid,
      payment_method: data.payment_method, customer: data.customer ?? null,
    });

    const { data: order, error: oErr } = await context.supabase
      .from("orders")
      .insert({ user_id: context.userId, status: "delivered", total, note } as any)
      .select().single();
    if (oErr) throw new Error(oErr.message);

    const items = data.items.map((it) => ({
      order_id: order.id, product_id: it.product_id, name: it.name,
      price: it.price, qty: it.qty, img: it.img ?? null,
    }));
    const { error: iErr } = await context.supabase.from("order_items").insert(items as any);
    if (iErr) {
      await context.supabase.from("orders").delete().eq("id", order.id);
      throw new Error(iErr.message);
    }

    // Decrement stock per product (no variation support in POS v1).
    for (const it of data.items) {
      const { data: p } = await context.supabase.from("products").select("stock").eq("id", it.product_id).maybeSingle();
      const cur = Number((p as any)?.stock ?? 0);
      const next = cur - it.qty;
      await context.supabase.from("products").update({ stock: next, in_stock: next > 0 } as any).eq("id", it.product_id);
    }

    return { id: order.id, total };
  });
