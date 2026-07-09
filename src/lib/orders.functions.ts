// Server functions for orders (users see own, admins see all).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const orderItemInput = z.object({
  product_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  qty: z.number().int().positive(),
  img: z.string().nullable().optional(),
});

const createOrderInput = z.object({
  items: z.array(orderItemInput).min(1),
  address: z.record(z.string(), z.any()).nullable().optional(),
  note: z.string().nullable().optional(),
});

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof createOrderInput>) => createOrderInput.parse(data))
  .handler(async ({ data, context }) => {
    const total = data.items.reduce((s, it) => s + it.price * it.qty, 0);
    const { data: order, error } = await context.supabase
      .from("orders")
      .insert({ user_id: context.userId, total, address: data.address ?? null, note: data.note ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const items = data.items.map((it) => ({ ...it, order_id: order.id }));
    const { error: itemsErr } = await context.supabase.from("order_items").insert(items);
    if (itemsErr) throw new Error(itemsErr.message);
    return order;
  });

// Admin
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const listAllOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const orderStatus = z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]);

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: z.infer<typeof orderStatus> }) =>
    z.object({ id: z.string().uuid(), status: orderStatus }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
