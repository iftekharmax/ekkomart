import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeft, Trash2, Search, User, Receipt, Loader2, Undo2, CheckCircle2, X } from "lucide-react";
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

const REASON_OPTIONS = [
  "Damaged product",
  "Defective / not working",
  "Wrong item delivered",
  "Size or color mismatch",
  "Customer changed mind",
  "Expired product",
  "Late delivery",
  "Duplicate order",
  "Other",
] as const;

function NewReturnPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listSalesForReturn);
  const getFn = useServerFn(getSaleForReturn);
  const createFn = useServerFn(createSalesReturn);

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["admin-sales-for-return"],
    queryFn: () => listFn(),
  });

  const [orderId, setOrderId] = useState<string>("");
  const [saleSearch, setSaleSearch] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reasonType, setReasonType] = useState<string>("");
  const [reasonOther, setReasonOther] = useState<string>("");
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<Line[]>([]);
  const [errors, setErrors] = useState<{ reason?: string; items?: string }>({});
  const suggestRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return (sales as any[]).slice(0, 8);
    return (sales as any[])
      .filter((p) => [p.invoice, p.customer].filter(Boolean).join(" ").toLowerCase().includes(q))
      .slice(0, 8);
  }, [sales, saleSearch]);

  useEffect(() => { setActiveIdx(0); }, [saleSearch, showSuggest]);

  const { data: saleDetail, isFetching: saleLoading } = useQuery({
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

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!suggestRef.current) return;
      if (!suggestRef.current.contains(e.target as Node)) setShowSuggest(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.quantity * i.unit_price, 0),
    [items],
  );

  const resolvedReason = reasonType === "Other" ? reasonOther.trim() : reasonType;

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
      const nextErrors: { reason?: string; items?: string } = {};
      if (!reasonType) nextErrors.reason = "Please select a return reason";
      else if (reasonType === "Other" && reasonOther.trim().length < 3)
        nextErrors.reason = "Please describe the reason (min 3 characters)";
      if (returnItems.length === 0) nextErrors.items = "Add at least one item with quantity > 0";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) {
        toast.error(nextErrors.reason ?? nextErrors.items!);
        throw new Error(nextErrors.reason ?? nextErrors.items!);
      }
      return createFn({
        data: {
          order_id: orderId || null,
          customer: customer.trim() || null,
          return_date: date,
          reference: null,
          reason: resolvedReason,
          notes: null,
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

  const pickSale = (p: any) => {
    setOrderId(p.id);
    setSaleSearch(`${p.invoice} — ${p.customer ?? "Walk-in"}`);
    setShowSuggest(false);
  };

  const clearSale = () => {
    setOrderId("");
    setSaleSearch("");
    setItems([]);
  };

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

      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2" ref={suggestRef}>
          <Label>Find sale</Label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={saleSearch}
              onChange={(e) => {
                setSaleSearch(e.target.value);
                setShowSuggest(true);
                if (orderId) setOrderId("");
              }}
              onFocus={() => setShowSuggest(true)}
              placeholder="Type invoice number or customer mobile / name…"
              className="h-11 rounded-lg pl-9"
              autoComplete="off"
            />
            {showSuggest && suggestions.length > 0 && (
              <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover shadow-lg">
                {suggestions.map((p: any) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => pickSale(p)}
                    className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-primary">
                        <Receipt className="h-3.5 w-3.5" /> {p.invoice}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> {p.customer ?? "Walk-in"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">৳{Number(p.total).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
            {showSuggest && saleSearch && suggestions.length === 0 && (
              <div className="absolute z-30 mt-1 w-full rounded-lg border bg-popover px-3 py-3 text-sm text-muted-foreground shadow-lg">
                No matching sale found. You can still create a manual return below.
              </div>
            )}
          </div>
          {orderId && (
            <button type="button" onClick={clearSale} className="mt-1.5 text-xs text-muted-foreground underline hover:text-foreground">
              Clear selected sale
            </button>
          )}
        </div>
        <div>
          <Label>Return date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Customer</Label>
          <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" />
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-card">
        <div className="border-b px-4 py-3 font-semibold">Items to return</div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {orderId ? "No returnable items on this sale" : "Search and pick a sale to load its items"}
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
          <Label className="flex items-center gap-1">
            Return reason <span className="text-rose-600">*</span>
          </Label>
          <Select
            value={reasonType}
            onValueChange={(v) => {
              setReasonType(v);
              if (errors.reason) setErrors((x) => ({ ...x, reason: undefined }));
            }}
          >
            <SelectTrigger
              className={`mt-1.5 ${errors.reason ? "border-rose-500 focus:ring-rose-500" : ""}`}
            >
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {REASON_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reasonType === "Other" && (
            <Textarea
              value={reasonOther}
              onChange={(e) => { setReasonOther(e.target.value); if (errors.reason) setErrors((x) => ({ ...x, reason: undefined })); }}
              placeholder="Describe the reason…"
              rows={3}
              className={`mt-2 ${errors.reason ? "border-rose-500 focus-visible:ring-rose-500" : ""}`}
              maxLength={500}
            />
          )}
          {errors.reason && <p className="mt-1 text-xs font-medium text-rose-600">{errors.reason}</p>}
        </div>
        <div className="rounded-xl border bg-card p-4 h-fit sticky top-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">৳{subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t pt-2 text-base">
            <span className="font-semibold">Total refund</span>
            <span className="font-bold text-primary">৳{subtotal.toFixed(2)}</span>
          </div>
          {errors.items && <p className="mt-2 text-xs font-medium text-rose-600">{errors.items}</p>}
          <Button className="mt-4 w-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Saving..." : "Create return"}
          </Button>
        </div>
      </div>
    </div>
  );
}
