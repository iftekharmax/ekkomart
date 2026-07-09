import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const listAdjustments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await (context.supabase.from("stock_adjustments" as any) as any)
      .select("*, product:products(id,name,unit), variation:product_variations(id,name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const adjustmentInput = z.object({
  product_id: z.string().uuid(),
  variation_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().refine((v) => v !== 0, "Quantity cannot be zero"),
  reason: z.string().min(1).default("manual"),
  note: z.string().nullable().optional(),
});

export const createAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof adjustmentInput>) => adjustmentInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row, error } = await (context.supabase.from("stock_adjustments" as any) as any)
      .insert({
        product_id: data.product_id,
        variation_id: data.variation_id ?? null,
        quantity: data.quantity,
        reason: data.reason,
        note: data.note ?? null,
        created_by: context.userId,
      }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAdjustment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase.from("stock_adjustments" as any) as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
