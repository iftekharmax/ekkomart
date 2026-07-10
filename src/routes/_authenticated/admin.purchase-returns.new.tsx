import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createPurchaseReturn } from "@/lib/purchase-returns.functions";
import { listPurchases, getPurchase } from "@/lib/purchases.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/purchase-returns/new")({
  head: () => ({ meta: [{ title: "New Purchase Return — Admin" }] }),
  component: NewReturnPage,
});

type Line = {
  key: string;
  product_id: string;
  variation_id: string | null;
  label: string;
  max: number;
  quantity: number;
  unit_cost: number;
};

function NewReturnPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listPurchases);
  const getFn = useServerFn(getPurchase);
  const createFn = useServerFn(createPurchaseReturn);

  const { data: purchases = [] } = useQuery({ queryKey: ["admin-purchases"], queryFn: () => listFn() });

  const [purchaseId, setPurchaseId] = useState<string>("");
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<Line[]>([]);

  const filteredPurchases = useMemo(() => {
    const q = purchaseSearch.trim().toLowerCase();
    if (!q) return purchases as any[];
    return (purchases as any[]).filter((p) =>
      [p.reference, p.supplier?.name, p.purchase_date].filter(Boolean).join(" ").toLowerCase().includes(q)
    );
  }, [purchases, purchaseSearch]);

  const { data: purchaseDetail } = useQuery({
    queryKey: ["admin-purchase-detail", purchaseId],
    queryFn: () => getFn({ data: { id: purchaseId } }),
    enabled: !!purchaseId,
  });

  useEffect(() => {
    if (!purchaseDetail) { setItems([]); return; }
    const its = (purchaseDetail.items as any[]).map((it) => ({
      key: it.id,
      product_id: it.product_id,
      variation_id: it.variation_id ?? null,
      label: `${it.product?.name ?? "—"}${it.variation?.name ? ` · ${it.variation.name}` : ""}`,
      max: Number(it.quantity),
      quantity: 0,
      unit_cost: Number(it.unit_cost ?? 0),
    }));
    setItems(its);
  }, [purchaseDetail]);

  const supplierId = purchaseDetail?.header?.supplier?.id ?? null;
  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_cost, 0),
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
          unit_cost: i.unit_cost,
        }));
      if (returnItems.length === 0) throw new Error("Add at least one item with quantity > 0");
      return createFn({
        data: {
          purchase_id: purchaseId || null,
          supplier_id: supplierId,
          return_date: date,
          reference: reference.trim() || null,
          reason: reason.trim() || null,
          items: returnItems,
        },
      });
    },
    onSuccess: () => {
      toast.success("Purchase return created");
      navigate({ to: "/admin/purchase-returns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">New Purchase Return</h2>
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label>Purchase invoice</Label>
          <Input value={purchaseSearch} onChange={(e) => setPurchaseSearch(e.target.value)}
            placeholder="Search by reference, supplier, or date" className="mb-2" />
          <Select value={purchaseId} onValueChange={setPurchaseId}>
            <SelectTrigger><SelectValue placeholder={filteredPurchases.length ? "Select purchase" : "No purchases match search"} /></SelectTrigger>
            <SelectContent>
              {filteredPurchases.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.reference} — {p.supplier?.name ?? "—"} ({p.purchase_date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {purchaseDetail?.header?.supplier?.name && (
            <p className="mt-1 text-xs text-muted-foreground">
              Supplier auto-filled: <span className="font-medium">{purchaseDetail.header.supplier.name}</span>
            </p>
          )}
        </div>
        <div>
          <Label>Return date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto-generate if empty" />
        </div>
      </div>

      {/* Items */}
      <div className="mt-4 rounded-xl border bg-card">
        <div className="border-b px-4 py-3 font-semibold">Items to return</div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {purchaseId ? "No items on this purchase" : "Select a purchase to load its items"}
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-2 p-3 md:hidden">
              {items.map((it, idx) => (
                <div key={it.key} className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{it.label}</div>
                  <div className="text-xs text-muted-foreground">Purchased: {it.max}</div>
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
                      <Label className="text-xs">Unit cost</Label>
                      <Input type="number" step="0.01" value={it.unit_cost}
                        onChange={(e) => {
                          const v = Math.max(0, Number(e.target.value));
                          setItems((prev) => prev.map((x, i) => i === idx ? { ...x, unit_cost: v } : x));
                        }} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Line total</span>
                    <span className="font-semibold">${(it.quantity * it.unit_cost).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-right">Purchased</th>
                    <th className="px-4 py-2 text-right">Return qty</th>
                    <th className="px-4 py-2 text-right">Unit cost</th>
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
                        <Input type="number" step="0.01" value={it.unit_cost}
                          className="ml-auto h-8 w-24 text-right"
                          onChange={(e) => {
                            const v = Math.max(0, Number(e.target.value));
                            setItems((prev) => prev.map((x, i) => i === idx ? { ...x, unit_cost: v } : x));
                          }} />
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">${(it.quantity * it.unit_cost).toFixed(2)}</td>
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
            placeholder="Damaged, wrong item, etc." rows={4} />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">${subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t pt-2 text-base">
            <span className="font-semibold">Total</span>
            <span className="font-bold">${subtotal.toFixed(2)}</span>
          </div>
          <Button className="mt-4 w-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Saving..." : "Create return"}
          </Button>
        </div>
      </div>
    </div>
  );
}
