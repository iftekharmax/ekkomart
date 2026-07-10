import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPosSale } from "@/lib/pos.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { printThermalReceipt } from "@/lib/thermal-print";

export const Route = createFileRoute("/_authenticated/admin/sales/$id")({
  head: () => ({ meta: [{ title: "Sale details — Admin" }] }),
  component: SaleDetailsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6">
        <p className="mb-2 text-sm text-destructive">Failed to load sale: {error.message}</p>
        <Button size="sm" onClick={() => { reset(); router.invalidate(); }}>Retry</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">Sale not found.</div>,
});

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;
const fmtDT = (s: string) => new Date(s).toLocaleString();

function SaleDetailsPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getPosSale);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-sale", id],
    queryFn: () => getFn({ data: { id } }),
  });

  if (isLoading) return <div className="p-6"><div className="h-40 animate-pulse rounded bg-muted" /></div>;
  if (isError || !data) return <div className="p-6 text-sm text-destructive">Failed to load sale.</div>;

  const status = data.paid >= data.total ? "Paid" : data.paid > 0 ? "Partial" : "Unpaid";
  const statusColor = status === "Paid" ? "bg-emerald-100 text-emerald-700" : status === "Partial" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link to="/admin/sales"><Button size="sm" variant="outline"><ArrowLeft className="mr-1 h-4 w-4" />Back</Button></Link>
          <h2 className="text-xl font-bold sm:text-2xl">Sale details</h2>
        </div>
        <Button size="sm" onClick={() => printThermalReceipt(data)}><Printer className="mr-1 h-4 w-4" />Print</Button>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-5">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <div><div className="text-xs text-muted-foreground">Invoice</div><div className="font-mono font-semibold">{data.invoice}</div></div>
          <div><div className="text-xs text-muted-foreground">Date / Time</div><div className="font-medium">{fmtDT(data.created_at)}</div></div>
          <div><div className="text-xs text-muted-foreground">Customer</div><div className="font-medium">{data.customer || "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">Payment</div><div className="font-medium capitalize">{data.payment_method}</div></div>
          <div><div className="text-xs text-muted-foreground">Status</div><div><span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusColor}`}>{status}</span></div></div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 text-right font-semibold">Price</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it: any) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">{it.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(it.price * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto grid w-full max-w-xs gap-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(data.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{money(data.discount)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span className="tabular-nums">{money(data.tax)}</span></div>
          <div className="flex justify-between border-t pt-1 text-base font-bold"><span>Total</span><span className="tabular-nums text-primary">{money(data.total)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="tabular-nums">{money(data.paid)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Change</span><span className="tabular-nums">{money(Math.max(0, data.paid - data.total))}</span></div>
        </div>
      </div>
    </div>
  );
}
