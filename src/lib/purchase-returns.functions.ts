// Server functions for the Purchase Return module.
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
  unit_cost: z.number().nonnegative().default(0),
});

const returnInput = z.object({
  purchase_id: z.string().uuid().nullable().optional(),
  supplier_id: z.string().uuid().nullable().optional(),
  return_date: z.string().optional(),
  reference: z.string().trim().max(100).nullable().optional(),
  reason: z.string().nullable().optional(),
  items: z.array(itemInput).min(1),
});

function makeReference() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `PRT-${yy}${mm}${dd}-${rnd}`;
}

export const listPurchaseReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase.from("purchase_returns" as any) as any)
      .select("*, supplier:suppliers(name), purchase:purchases(reference), items:purchase_return_items(id,quantity,line_total,product:products(name),variation:product_variations(name))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPurchaseReturn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: header, error } = await (context.supabase.from("purchase_returns" as any) as any)
      .select("*, supplier:suppliers(id,name), purchase:purchases(id,reference)")
      .eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: items, error: e2 } = await (context.supabase.from("purchase_return_items" as any) as any)
      .select("*, product:products(id,name,unit), variation:product_variations(id,name)")
      .eq("return_id", data.id);
    if (e2) throw new Error(e2.message);
    return { header, items: items ?? [] };
  });

export const createPurchaseReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof returnInput>) => returnInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Auto-fill supplier from selected purchase when omitted.
    let supplierId = data.supplier_id ?? null;
    if (data.purchase_id) {
      const { data: p } = await (context.supabase.from("purchases" as any) as any)
        .select("supplier_id").eq("id", data.purchase_id).single();
      if (p?.supplier_id) supplierId = p.supplier_id;
    }
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
    const header = {
      reference: data.reference?.trim() ? data.reference.trim() : makeReference(),
      purchase_id: data.purchase_id ?? null,
      supplier_id: supplierId,
      return_date: data.return_date ?? new Date().toISOString().slice(0, 10),
      reason: data.reason ?? null,
      subtotal,
      total: subtotal,
      status: "completed",
      created_by: context.userId,
    };
    const { data: row, error } = await (context.supabase.from("purchase_returns" as any) as any)
      .insert(header as any).select().single();
    if (error) throw new Error(error.message);
    const items = data.items.map((i) => ({
      return_id: row.id,
      product_id: i.product_id,
      variation_id: i.variation_id ?? null,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      line_total: i.quantity * i.unit_cost,
    }));
    const { error: e2 } = await (context.supabase.from("purchase_return_items" as any) as any).insert(items as any);
    if (e2) {
      await (context.supabase.from("purchase_returns" as any) as any).delete().eq("id", row.id);
      throw new Error(e2.message);
    }
    return row;
  });

export const voidPurchaseReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error: e0 } = await (context.supabase.from("purchase_returns" as any) as any)
      .select("status").eq("id", data.id).single();
    if (e0) throw new Error(e0.message);
    if (row.status === "voided") return { ok: true };
    const { error } = await (context.supabase.from("purchase_returns" as any) as any)
      .update({ status: "voided" } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePurchaseReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("purchase_returns" as any) as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
