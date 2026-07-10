// POS server functions — product search + sale creation reusing orders/order_items.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, searchPosProducts } from "./pos.server";

export const posSearchProducts = createServerFn({ method: "GET" })
  .inputValidator((d: { q?: string; limit?: number }) =>
    z.object({ q: z.string().optional().default(""), limit: z.number().int().min(1).max(60).optional().default(24) }).parse(d))
  .handler(async ({ data }) => {
    return searchPosProducts(data);
  });



const quickProductInput = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
});

export const createPosQuickProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof quickProductInput>) => quickProductInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 7);
    const { data: row, error } = await context.supabase.from("products").insert({
      name: data.name, price: data.price, stock: data.stock, in_stock: data.stock > 0,
      barcode: data.barcode || null, sku: data.sku || null, category: "POS", slug,
    } as any).select("id,name,sku,barcode,price,stock,img,unit").single();
    if (error) throw new Error(error.message);
    return row;
  });

const saleInput = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    variation_id: z.string().uuid().nullable().optional(),
    name: z.string().min(1),
    parent_name: z.string().nullable().optional(),
    variation_name: z.string().nullable().optional(),
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
    const { data: rows, error } = await (context.supabase.rpc as any)("pos_create_sale", {
      _items: data.items.map((it) => ({
        product_id: it.product_id,
        variation_id: it.variation_id ?? null,
        name: it.name,
        parent_name: it.parent_name ?? null,
        variation_name: it.variation_name ?? null,
        price: it.price,
        qty: it.qty,
        img: it.img ?? null,
      })),
      _discount: data.discount,
      _tax: data.tax,
      _paid: data.paid,
      _payment_method: data.payment_method,
      _customer: data.customer ?? null,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { id: row.id as string, total: Number(row.total) || 0 };
  });


export const listPosTodaySales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data, error } = await context.supabase
      .from("orders")
      .select("id,total,note,created_at, order_items(name,qty,price)")
      .eq("user_id", context.userId)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((o: any) => {
      try { return JSON.parse(o.note ?? "{}")?.pos === true; } catch { return false; }
    }).map((o: any) => {
      let meta: any = {};
      try { meta = JSON.parse(o.note ?? "{}"); } catch {}
      const items = (o.order_items ?? []).map((it: any) => ({
        name: String(it.name ?? ""), qty: Number(it.qty) || 0, price: Number(it.price) || 0,
      }));
      const quantity = items.reduce((s: number, it: any) => s + it.qty, 0);
      return {
        id: o.id as string,
        total: Number(o.total) || 0,
        created_at: o.created_at as string,
        payment_method: (meta.payment_method as string) ?? "cash",
        customer: (meta.customer as string) ?? null,
        items,
        quantity,
      };
    });
    const total = rows.reduce((s, r) => s + r.total, 0);
    return { rows, total, count: rows.length };
  });

export const listPosSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("orders")
      .select("id,total,note,created_at, order_items(name,qty,price)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).filter((o: any) => {
      try { return JSON.parse(o.note ?? "{}")?.pos === true; } catch { return false; }
    }).map((o: any) => {
      let meta: any = {};
      try { meta = JSON.parse(o.note ?? "{}"); } catch {}
      const items = (o.order_items ?? []).map((it: any) => ({
        name: String(it.name ?? ""), qty: Number(it.qty) || 0, price: Number(it.price) || 0,
      }));
      const quantity = items.reduce((s: number, it: any) => s + it.qty, 0);
      return {
        id: o.id as string,
        invoice: `INV-${String(o.id).slice(0, 8).toUpperCase()}`,
        total: Number(o.total) || 0,
        created_at: o.created_at as string,
        payment_method: (meta.payment_method as string) ?? "cash",
        customer: (meta.customer as string) ?? null,
        items,
        quantity,
        items_count: items.length,
        tax: Number(meta.tax) || 0,
        subtotal: Number(meta.subtotal) || 0,
        discount: Number(meta.discount) || 0,
      };
    });
    const total = rows.reduce((s, r) => s + r.total, 0);
    return { rows, total, count: rows.length };
  });

export const getPosSale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: o, error } = await context.supabase
      .from("orders")
      .select("id,total,note,created_at,user_id, order_items(id,name,qty,price,img)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Sale not found");
    let meta: any = {};
    try { meta = JSON.parse((o as any).note ?? "{}"); } catch {}

    let staff: string | null = null;
    const uid = (o as any).user_id as string | null;
    if (uid) {
      const { data: prof } = await context.supabase
        .from("profiles").select("full_name").eq("id", uid).maybeSingle();
      staff = (prof as any)?.full_name ?? null;
    }

    return {
      id: (o as any).id as string,
      invoice: `INV-${String((o as any).id).slice(0, 8).toUpperCase()}`,
      total: Number((o as any).total) || 0,
      created_at: (o as any).created_at as string,
      subtotal: Number(meta.subtotal) || 0,
      discount: Number(meta.discount) || 0,
      tax: Number(meta.tax) || 0,
      paid: Number(meta.paid) || 0,
      payment_method: (meta.payment_method as string) ?? "cash",
      customer: (meta.customer as string) ?? null,
      staff,
      items: ((o as any).order_items ?? []).map((it: any) => ({
        id: it.id, name: String(it.name ?? ""), qty: Number(it.qty) || 0, price: Number(it.price) || 0, img: it.img ?? null,
      })),
    };
  });

export const deletePosSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Restore stock for the items in this sale (variation-aware)
    const { data: items } = await context.supabase
      .from("order_items")
      .select("product_id,variation_id,qty")
      .eq("order_id", data.id);
    for (const it of (items ?? []) as any[]) {
      const qty = Number(it.qty || 0);
      if (!qty) continue;
      if (it.variation_id) {
        const { data: v } = await context.supabase.from("product_variations").select("stock").eq("id", it.variation_id).maybeSingle();
        const next = Number((v as any)?.stock ?? 0) + qty;
        await context.supabase.from("product_variations").update({ stock: next } as any).eq("id", it.variation_id);
      } else if (it.product_id) {
        const { data: p } = await context.supabase.from("products").select("stock").eq("id", it.product_id).maybeSingle();
        const next = Number((p as any)?.stock ?? 0) + qty;
        await context.supabase.from("products").update({ stock: next, in_stock: next > 0 } as any).eq("id", it.product_id);
      }

    }

    await context.supabase.from("order_items").delete().eq("order_id", data.id);
    const { error } = await context.supabase.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateSaleInput = z.object({
  id: z.string().uuid(),
  customer: z.string().optional().nullable(),
  payment_method: z.enum(["cash", "card", "mobile", "other"]),
});

export const updatePosSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof updateSaleInput>) => updateSaleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: o, error: gErr } = await context.supabase.from("orders").select("note").eq("id", data.id).maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!o) throw new Error("Sale not found");
    let meta: any = {};
    try { meta = JSON.parse((o as any).note ?? "{}"); } catch {}
    meta.customer = data.customer ?? null;
    meta.payment_method = data.payment_method;
    const { error } = await context.supabase.from("orders").update({ note: JSON.stringify(meta) } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
