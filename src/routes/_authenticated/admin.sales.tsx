import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listPosSales, deletePosSale } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Trash2, Search, Receipt, Printer } from "lucide-react";
import { toast } from "sonner";
import { printThermalReceipt } from "@/lib/thermal-print";

export const Route = createFileRoute("/_authenticated/admin/sales")({
  head: () => ({ meta: [{ title: "Sales — Admin" }] }),
  component: SalesPage,
});

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDT = (s: string) => new Date(s).toLocaleString();

function SalesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPosSales);
  const delFn = useServerFn(deletePosSale);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-sales"],
    queryFn: () => listFn(),
  });

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59.999").getTime() : null;
    const list = rows.filter((r) => {
      if (qq && !(r.customer ?? "").toLowerCase().includes(qq) && !r.invoice.toLowerCase().includes(qq)) return false;
      const ts = new Date(r.created_at).getTime();
      if (fromTs !== null && ts < fromTs) return false;
      if (toTs !== null && ts > toTs) return false;
      return true;
    });
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [rows, q, from, to]);

  const totalAmount = filtered.reduce((s, r) => s + r.total, 0);

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Sale deleted (stock restored)");
      qc.invalidateQueries({ queryKey: ["admin-sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Sales</h2>
          <p className="hidden text-sm text-muted-foreground sm:block">All POS sales — view, print or delete.</p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-lg font-bold tabular-nums text-primary">{money(totalAmount)}</div>
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by customer or invoice" className="pl-9" aria-label="Search sales" />
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" className="sm:w-[160px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" className="sm:w-[160px]" />
        {(q || from || to) && (
          <Button variant="outline" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>Clear</Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Invoice</th>
              <th className="px-4 py-3 font-semibold">Date / Time</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 text-right font-semibold">Items</th>
              <th className="px-4 py-3 text-right font-semibold">Qty</th>
              <th className="px-4 py-3 text-right font-semibold">Tax</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-t"><td colSpan={8} className="px-4 py-3"><div className="h-6 animate-pulse rounded bg-muted" /></td></tr>
              ))
            ) : isError ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center">
                <p className="mb-2 text-sm text-destructive">Failed to load sales.</p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                    <Receipt className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">No sales found</p>
                    <p className="text-sm text-muted-foreground">{q || from || to ? "Try different filters." : "POS sales will appear here."}</p>
                  </div>
                </div>
              </td></tr>
            ) : filtered.map((r) => (
              <tr key={r.id} className="border-t align-middle">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link to="/admin/sales/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.invoice}</Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{fmtDT(r.created_at)}</td>
                <td className="px-4 py-3">{r.customer || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.items_count}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(r.tax)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.total)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Link to="/admin/sales/$id" params={{ id: r.id }}>
                      <Button size="sm" variant="outline" title="View"><Eye className="h-4 w-4" /></Button>
                    </Link>
                    <Button size="sm" variant="outline" title="Print receipt" onClick={() => printThermalReceipt({
                      invoice: r.invoice, created_at: r.created_at, customer: r.customer, payment_method: r.payment_method,
                      items: r.items, subtotal: r.subtotal, discount: r.discount, tax: r.tax, total: r.total, paid: r.total,
                    })}><Printer className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" title="Delete" onClick={() => {
                      if (confirm("Delete this sale? Stock will be restored.")) del.mutate(r.id);
                    }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
