// Server functions for the Purchase module.
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
    .schema("private" as any)
    .rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) {
    // Fallback: check via user_roles table (RLS-safe for self).
    const { data: rows } = await context.supabase.from("user_roles" as any).select("role").eq("user_id", context.userId);
    const ok = (rows ?? []).some((r: any) => r.role === "admin");
    if (!ok) throw new Error("Forbidden");
  }
}

const itemInput = z.object({
  product_id: z.string().uuid(),
  variation_id: z.string().uuid().nullable().optional(),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative().default(0),
});

const purchaseInput = z.object({
  supplier_id: z.string().uuid().nullable().optional(),
  purchase_date: z.string().optional(),
  reference: z.string().trim().max(100).nullable().optional(),
  note: z.string().nullable().optional(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  shipping: z.number().nonnegative().default(0),
  paid: z.number().nonnegative().default(0),
  status: z.enum(["received", "pending"]).default("received"),
  items: z.array(itemInput).min(1),
});

function makeReference() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `PUR-${yy}${mm}${dd}-${rnd}`;
}

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase.from("purchases" as any) as any)
      .select("*, supplier:suppliers(name), items:purchase_items(id,quantity,line_total,product:products(name),variation:product_variations(name))")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPurchase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: header, error } = await (context.supabase.from("purchases" as any) as any)
      .select("*, supplier:suppliers(id,name)").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: items, error: e2 } = await (context.supabase.from("purchase_items" as any) as any)
      .select("*, product:products(id,name,unit,product_type), variation:product_variations(id,name)")
      .eq("purchase_id", data.id);
    if (e2) throw new Error(e2.message);
    const { data: payments, error: e3 } = await (context.supabase.from("purchase_payments" as any) as any)
      .select("*").eq("purchase_id", data.id).order("paid_at", { ascending: false });
    if (e3) throw new Error(e3.message);
    const { data: returns, error: e4 } = await (context.supabase.from("purchase_returns" as any) as any)
      .select("id,reference,return_date,total,reason,status")
      .eq("purchase_id", data.id).order("return_date", { ascending: false });
    if (e4) throw new Error(e4.message);
    return { header, items: items ?? [], payments: payments ?? [], returns: returns ?? [] };
  });


export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof purchaseInput>) => purchaseInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);
    const total = subtotal - data.discount + data.tax + data.shipping;
    const header = {
      reference: (data.reference?.trim() ? data.reference.trim() : makeReference()),
      supplier_id: data.supplier_id ?? null,
      purchase_date: data.purchase_date ?? new Date().toISOString().slice(0, 10),
      note: data.note ?? null,
      subtotal, discount: data.discount, tax: data.tax, shipping: data.shipping, total,
      paid: data.paid, status: data.status, created_by: context.userId,
    };
    const { data: row, error } = await (context.supabase.from("purchases" as any) as any)
      .insert(header as any).select().single();
    if (error) throw new Error(error.message);
    const items = data.items.map((i) => ({
      purchase_id: row.id,
      product_id: i.product_id,
      variation_id: i.variation_id ?? null,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      line_total: i.quantity * i.unit_cost,
    }));
    const { error: e2 } = await (context.supabase.from("purchase_items" as any) as any).insert(items as any);
    if (e2) {
      await (context.supabase.from("purchases" as any) as any).delete().eq("id", row.id);
      throw new Error(e2.message);
    }
    return row;
  });

export const payPurchaseDue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; amount: number; receipt_no?: string | null; note?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      amount: z.number().positive(),
      receipt_no: z.string().trim().max(100).nullable().optional(),
      note: z.string().trim().max(1000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase.from("purchases" as any) as any)
      .select("total,paid").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: rets } = await (context.supabase.from("purchase_returns" as any) as any)
      .select("total,status").eq("purchase_id", data.id);
    const returnedTotal = (rets ?? [])
      .filter((r: any) => r.status !== "voided")
      .reduce((s: number, r: any) => s + Number(r.total ?? 0), 0);
    const total = Number(row.total);
    const paid = Number(row.paid ?? 0);
    const due = Math.max(0, total - returnedTotal - paid);
    if (data.amount > due + 0.0001) throw new Error(`Payment exceeds due ($${due.toFixed(2)})`);
    const newPaid = paid + data.amount;
    const { error: e2 } = await (context.supabase.from("purchases" as any) as any)
      .update({ paid: newPaid } as any).eq("id", data.id);
    if (e2) throw new Error(e2.message);
    const { error: e3 } = await (context.supabase.from("purchase_payments" as any) as any).insert({

      purchase_id: data.id,
      amount: data.amount,
      receipt_no: data.receipt_no?.trim() || null,
      note: data.note?.trim() || null,
      created_by: context.userId,
    } as any);
    if (e3) throw new Error(e3.message);
    return { ok: true, paid: newPaid };
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Cascade delete of items triggers stock reversal.
    const { error } = await (context.supabase.from("purchases" as any) as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
