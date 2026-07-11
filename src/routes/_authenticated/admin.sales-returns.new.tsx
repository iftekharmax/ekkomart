import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createSalesReturn, listSalesForReturn, getSaleForReturn,
} from "@/lib/sales-returns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/sales-returns/new")({
  head: () => ({ meta: [{ title: "New Sales Return — Admin" }] }),
  component: NewReturnPage,
});

type Line = {
  key: string;
  product_id: string;
  variation_id: string | null;
  label: string;
  max: number;
  quantity: number;
  unit_price: number;
};

function NewReturnPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listSalesForReturn);
  const getFn = useServerFn(getSaleForReturn);
  const createFn = useServerFn(createSalesReturn);

  const { data: sales = [] } = useQuery({ queryKey: ["admin-sales-for-return"], queryFn: () => listFn() });

  const [orderId, setOrderId] = useState<string>("");
  const [saleSearch, setSaleSearch] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<Line[]>([]);
  const [errors, setErrors] = useState<{ reason?: string; items?: string }>({});

  const filteredSales = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return sales as any[];
    return (sales as any[]).filter((p) =>
      [p.invoice, p.customer].filter(Boolean).join(" ").toLowerCase().includes(q),
    );
  }, [sales, saleSearch]);

  const { data: saleDetail } = useQuery({
    queryKey: ["admin-sale-detail-for-return", orderId],
    queryFn: () => getFn({ data: { id: orderId } }),
    enabled: !!orderId,
  });

  useEffect(() => {
    if (!saleDetail) { setItems([]); return; }
    setCustomer(saleDetail.customer ?? "");
    setItems((saleDetail.items as any[])
      .filter((it: any) => it.product_id)
      .map((it: any) => ({
        key: it.id,
        product_id: it.product_id as string,
        variation_id: it.variation_id ?? null,
        label: it.name,
        max: it.qty,
        quantity: 0,
        unit_price: it.price,
      })));
  }, [saleDetail]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items],
  );

  const create = useMutation({
    mutationFn: () => {
      const returnItems = items
        .filter((i) => i.quantity > 0)
        .map((i) => ({
          product_id: i.product_id,
          variation_id: i.variation_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }));
      if (returnItems.length === 0) throw new Error("Add at least one item with quantity > 0");
      return createFn({
        data: {
          order_id: orderId || null,
          customer: customer.trim() || null,
          return_date: date,
          reference: reference.trim() || null,
          reason: reason.trim() || null,
          items: returnItems,
        },
      });
    },
    onSuccess: () => {
      toast.success("Sales return created — stock restored");
      navigate({ to: "/admin/sales-returns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigate({ to: "/admin/sales-returns" })}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-xl font-bold sm:text-2xl">New Sales Return</h2>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Sale invoice (optional)</Label>
          <Input value={saleSearch} onChange={(e) => setSaleSearch(e.target.value)}
            placeholder="Search invoice or customer" className="mb-2" />
          <Select value={orderId} onValueChange={setOrderId}>
            <SelectTrigger><SelectValue placeholder={filteredSales.length ? "Select sale" : "No sales match"} /></SelectTrigger>
            <SelectContent>
              {filteredSales.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.invoice} — {p.customer ?? "Walk-in"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Return date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto if empty" />
        </div>
        <div className="sm:col-span-2">
          <Label>Customer</Label>
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card">
        <div className="border-b px-4 py-3 font-semibold">Items to return</div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {orderId ? "No returnable items on this sale" : "Select a sale to load its items"}
          </div>
        ) : (
          <>
            <div className="space-y-2 p-3 md:hidden">
              {items.map((it, idx) => (
                <div key={it.key} className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-xs text-muted-foreground">Sold: {it.max}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Return qty</Label>
                      <Input type="number" min={0} max={it.max} value={it.quantity}
                        onChange={(e) => {
                          const v = Math.min(it.max, Math.max(0, Number(e.target.value)));
                          setItems((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: v } : x));
                        }} />
                    </div>
                    <div>
                      <Label className="text-xs">Unit price</Label>
                      <Input type="number" step="0.01" value={it.unit_price}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          setItems((prev) => prev.map((x, i) => i === idx ? { ...x, unit_price: v } : x));
                        }} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Line total</span>
                    <span className="font-semibold">৳{(it.quantity * it.unit_price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-right">Sold</th>
                    <th className="px-4 py-2 text-right">Return qty</th>
                    <th className="px-4 py-2 text-right">Unit price</th>
                    <th className="px-4 py-2 text-right">Line total</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.key} className="border-t">
                      <td className="px-4 py-2">{it.label}</td>
                      <td className="px-4 py-2 text-right">{it.max}</td>
                      <td className="px-4 py-2 text-right">
                        <Input type="number" min={0} max={it.max} value={it.quantity}
                          className="ml-auto h-8 w-24 text-right"
                          onChange={(e) => {
                            const v = Math.min(it.max, Math.max(0, Number(e.target.value)));
                            setItems((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: v } : x));
                          }} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Input type="number" step="0.01" value={it.unit_price}
                          className="ml-auto h-8 w-24 text-right"
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value));
                            setItems((prev) => prev.map((x, i) => i === idx ? { ...x, unit_price: v } : x));
                          }} />
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">৳{(it.quantity * it.unit_price).toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setItems((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: 0 } : x));
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-xl border bg-card p-4">
          <Label>Reason / note</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Damaged, wrong item, customer changed mind, etc." rows={4} />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">৳{subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t pt-2 text-base">
            <span className="font-semibold">Total refund</span>
            <span className="font-bold">৳{subtotal.toFixed(2)}</span>
          </div>
          <Button className="mt-4 w-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Saving..." : "Create return"}
          </Button>
        </div>
      </div>
    </div>
  );
}
