// Server functions for the Sales Return module.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

const itemInput = z.object({
  product_id: z.string().uuid(),
  variation_id: z.string().uuid().nullable().optional(),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative().default(0),
});

const returnInput = z.object({
  order_id: z.string().uuid().nullable().optional(),
  customer: z.string().nullable().optional(),
  return_date: z.string().optional(),
  reference: z.string().trim().max(100).nullable().optional(),
  reason: z.string().trim().min(3, "Reason is required").max(500),
  notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(itemInput).min(1),
});

function makeReference() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `SRT-${yy}${mm}${dd}-${rnd}`;
}

async function loadNameMap(ids: string[]) {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profs } = await (supabaseAdmin as any).from("profiles").select("id,full_name").in("id", ids);
  for (const p of (profs ?? []) as any[]) map.set(p.id, p.full_name);
  return map;
}

export const listSalesReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase.from("sales_returns" as any) as any)
      .select("*, items:sales_return_items(id,quantity,line_total,product:products(name),variation:product_variations(name))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    const ids = Array.from(new Set(rows.flatMap((r) => [r.created_by, r.voided_by]).filter(Boolean))) as string[];
    const nameMap = await loadNameMap(ids);
    return rows.map((r) => ({
      ...r,
      creator_name: r.created_by ? nameMap.get(r.created_by) ?? null : null,
      voider_name: r.voided_by ? nameMap.get(r.voided_by) ?? null : null,
    }));
  });

export const getSalesReturn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: header, error } = await (context.supabase.from("sales_returns" as any) as any)
      .select("*")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const ids = [header.created_by, header.voided_by].filter(Boolean) as string[];
    const nameMap = await loadNameMap(ids);
    (header as any).creator_name = header.created_by ? nameMap.get(header.created_by) ?? null : null;
    (header as any).voider_name = header.voided_by ? nameMap.get(header.voided_by) ?? null : null;
    const { data: items, error: e2 } = await (context.supabase.from("sales_return_items" as any) as any)
      .select("*, product:products(id,name,unit), variation:product_variations(id,name)")
      .eq("return_id", data.id);
    if (e2) throw new Error(e2.message);
    return { header, items: items ?? [] };
  });

// List POS sales (from orders where note.pos=true) — used by the New Return picker.
export const listSalesForReturn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("orders")
      .select("id,total,note,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).filter((o: any) => {
      try { return JSON.parse(o.note ?? "{}")?.pos === true; } catch { return false; }
    }).map((o: any) => {
      let meta: any = {};
      try { meta = JSON.parse(o.note ?? "{}"); } catch {}
      return {
        id: o.id as string,
        invoice: `INV-${String(o.id).slice(0, 8).toUpperCase()}`,
        customer: (meta.customer as string) ?? null,
        created_at: o.created_at as string,
        total: Number(o.total) || 0,
      };
    });
  });

export const getSaleForReturn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: o, error } = await context.supabase
      .from("orders")
      .select("id,note,total,created_at, order_items(id,product_id,variation_id,name,price,qty)")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!o) throw new Error("Sale not found");
    let meta: any = {};
    try { meta = JSON.parse((o as any).note ?? "{}"); } catch {}
    return {
      id: (o as any).id as string,
      invoice: `INV-${String((o as any).id).slice(0, 8).toUpperCase()}`,
      customer: (meta.customer as string) ?? null,
      subtotal: Number(meta.subtotal) || 0,
      discount: Number(meta.discount) || 0,
      tax: Number(meta.tax) || 0,
      total: Number((o as any).total) || 0,
      items: ((o as any).order_items ?? []).map((it: any) => ({
        id: it.id,
        product_id: it.product_id,
        variation_id: it.variation_id,
        name: String(it.name ?? ""),
        qty: Number(it.qty) || 0,
        price: Number(it.price) || 0,
      })),
    };
  });

export const createSalesReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof returnInput>) => returnInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let customer = data.customer ?? null;
    if (!customer && data.order_id) {
      const { data: o } = await context.supabase.from("orders").select("note").eq("id", data.order_id).maybeSingle();
      try { customer = (JSON.parse((o as any)?.note ?? "{}").customer as string) ?? null; } catch {}
    }
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const header = {
      reference: data.reference?.trim() ? data.reference.trim() : makeReference(),
      order_id: data.order_id ?? null,
      customer,
      return_date: data.return_date ?? new Date().toISOString().slice(0, 10),
      reason: data.reason,
      notes: data.notes ?? null,
      subtotal,
      total: subtotal,
      status: "completed",
      created_by: context.userId,
    };
    const { data: row, error } = await (context.supabase.from("sales_returns" as any) as any)
      .insert(header as any).select().single();
    if (error) throw new Error(error.message);
    const items = data.items.map((i) => ({
      return_id: row.id,
      product_id: i.product_id,
      variation_id: i.variation_id ?? null,
      quantity: i.quantity,
      unit_price: i.unit_price,
      line_total: i.quantity * i.unit_price,
    }));
    const { error: e2 } = await (context.supabase.from("sales_return_items" as any) as any).insert(items as any);
    if (e2) {
      await (context.supabase.from("sales_returns" as any) as any).delete().eq("id", row.id);
      throw new Error(e2.message);
    }
    return row;
  });

export const voidSalesReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason: string }) =>
    z.object({
      id: z.string().uuid(),
      reason: z.string().trim().min(3, "Reason is required").max(500),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error: e0 } = await (context.supabase.from("sales_returns" as any) as any)
      .select("status").eq("id", data.id).single();
    if (e0) throw new Error(e0.message);
    if (row.status === "voided") return { ok: true };
    const { error } = await (context.supabase.from("sales_returns" as any) as any)
      .update({
        status: "voided",
        void_reason: data.reason,
        voided_at: new Date().toISOString(),
        voided_by: context.userId,
      } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSalesReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("sales_returns" as any) as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
