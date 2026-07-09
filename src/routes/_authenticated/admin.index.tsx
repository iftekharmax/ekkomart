import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, ShoppingBag, Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [stats, setStats] = useState({ products: 0, orders: 0, users: 0, revenue: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: products }, { data: orders }, { count: users }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("orders").select("total"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      const revenue = (orders ?? []).reduce((s: number, o: { total: number | string }) => s + Number(o.total), 0);
      setStats({
        products: products ?? 0,
        orders: orders?.length ?? 0,
        users: users ?? 0,
        revenue,
      });
    })();
  }, []);

  const cards = [
    { label: "Products", value: stats.products, icon: Package, color: "text-blue-600" },
    { label: "Orders", value: stats.orders, icon: ShoppingBag, color: "text-purple-600" },
    { label: "Users", value: stats.users, icon: Users, color: "text-emerald-600" },
    { label: "Revenue", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: "text-amber-600" },
  ];

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Overview</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-5">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
