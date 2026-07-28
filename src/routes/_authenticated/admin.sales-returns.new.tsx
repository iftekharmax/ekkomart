import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createSalesReturn, listSalesForReturn, getSaleForReturn,
} from "@/lib/sales-returns.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Trash2, Search, User, Receipt, Loader2, Undo2, CheckCircle2, X, PackageCheck, PackageOpen } from "lucide-react";
import { toast } from "sonner";

type RestockedLine = { label: string; quantity: number; unit_price: number };

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
  const qc = useQueryClient();
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
  const [restockedModal, setRestockedModal] = useState<RestockedLine[] | null>(null);
  const [restockLoading, setRestockLoading] = useState(false);
  const openRestockModal = (lines: RestockedLine[]) => {
    setRestockLoading(true);
    setRestockedModal([]);
    setTimeout(() => {
      setRestockedModal(lines);
      setRestockLoading(false);
    }, 400);
  };
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

  // Prorate the original sale's discount/tax against the returned portion.
  const saleSub = Number(saleDetail?.subtotal) || 0;
  const saleDiscount = Number(saleDetail?.discount) || 0;
  const saleTax = Number(saleDetail?.tax) || 0;
  const ratio = saleSub > 0 ? Math.min(1, subtotal / saleSub) : 0;
  const discount = +(saleDiscount * ratio).toFixed(2);
  const tax = +(saleTax * ratio).toFixed(2);
  const totalRefund = Math.max(0, subtotal - discount + tax);

  const resolvedReason = reasonType === "Other" ? reasonOther.trim() : reasonType;

  const create = useMutation({
    mutationFn: async () => {
      const returnItems = items
        .filter((i) => i.quantity > 0)
        .map((i) => ({
          product_id: i.product_id,
          variation_id: i.variation_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          label: i.label,
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
      await createFn({
        data: {
          order_id: orderId || null,
          customer: customer.trim() || null,
          return_date: date,
          reference: null,
          reason: resolvedReason,
          notes: null,
          items: returnItems.map(({ label: _l, ...rest }) => rest),
        },
      });
      return returnItems;
    },
    onSuccess: (returnItems) => {
      const totalQty = returnItems.reduce((s, i) => s + i.quantity, 0);
      const title = `Sales return created — ${returnItems.length} item${returnItems.length > 1 ? "s" : ""} restocked (${totalQty} unit${totalQty > 1 ? "s" : ""})`;
      const lines: RestockedLine[] = returnItems.map((i) => ({
        label: i.label, quantity: i.quantity, unit_price: i.unit_price,
      }));
      toast.success(title, {
        description: `${returnItems.slice(0, 2).map((i) => `${i.label} ×${i.quantity}`).join(", ")}${returnItems.length > 2 ? `, +${returnItems.length - 2} more` : ""}`,
        duration: 8000,
        action: { label: "View details", onClick: () => setRestockedModal(lines) },
      });

      qc.invalidateQueries({ queryKey: ["admin-sales-returns"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setRestockedModal(lines);
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
    <>
    <div className="mx-auto max-w-4xl">
      {/* Hero header */}
      <div className="mb-5">
        <button
          onClick={() => navigate({ to: "/admin/sales-returns" })}
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to returns
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
              <Undo2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">Returns</p>
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">New Sales Return</h2>
            </div>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            Stock will be <span className="font-semibold text-emerald-600">restored automatically</span> once saved
          </div>
        </div>
      </div>

      {/* Find sale card */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2" ref={suggestRef}>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Find sale</Label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={saleSearch}
                onChange={(e) => {
                  setSaleSearch(e.target.value);
                  setShowSuggest(true);
                  if (orderId) setOrderId("");
                }}
                onFocus={() => setShowSuggest(true)}
                onKeyDown={(e) => {
                  if (!showSuggest) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveIdx((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    if (suggestions[activeIdx]) {
                      e.preventDefault();
                      pickSale(suggestions[activeIdx]);
                    }
                  } else if (e.key === "Escape") {
                    setShowSuggest(false);
                  }
                }}
                placeholder="Type invoice number or customer mobile / name…"
                className="h-11 rounded-xl border-2 pl-9 pr-9 text-sm font-medium shadow-sm focus-visible:border-primary"
                autoComplete="off"
                role="combobox"
                aria-expanded={showSuggest}
                aria-controls="sale-suggestions"
              />
              {salesLoading && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {!salesLoading && saleSearch && (
                <button
                  type="button"
                  onClick={() => { setSaleSearch(""); setShowSuggest(true); if (orderId) setOrderId(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {showSuggest && (
                <div
                  id="sale-suggestions"
                  role="listbox"
                  className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border bg-popover shadow-xl"
                >
                  {salesLoading ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading recent sales…
                    </div>
                  ) : suggestions.length > 0 ? (
                    suggestions.map((p: any, i: number) => (
                      <button
                        type="button"
                        key={p.id}
                        role="option"
                        aria-selected={i === activeIdx}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => pickSale(p)}
                        className={`flex w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left text-sm last:border-b-0 transition-colors ${i === activeIdx ? "bg-primary/10" : "hover:bg-muted"}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-primary">
                            <Receipt className="h-3.5 w-3.5" /> {p.invoice}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <User className="h-3 w-3" /> {p.customer ?? "Walk-in"}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          ৳{Number(p.total).toFixed(2)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-muted-foreground">
                      No matching sale found. You can still create a manual return below.
                    </div>
                  )}
                </div>
              )}
            </div>
            {orderId && (
              <button type="button" onClick={clearSale} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                <X className="h-3 w-3" /> Clear selected sale
              </button>
            )}
            {saleLoading && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading sale items…
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Return date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 h-11 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" className="mt-1.5 h-11 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 text-primary" /> Items to return
          </div>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground">{items.filter(i => i.quantity > 0).length} of {items.length} selected</span>
          )}
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
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
            <span className="font-semibold tabular-nums">৳{subtotal.toFixed(2)}</span>
          </div>
          {saleDiscount > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Discount <span className="text-[10px] uppercase">(prorated)</span></span>
              <span className="font-semibold tabular-nums text-rose-600">−৳{discount.toFixed(2)}</span>
            </div>
          )}
          {saleTax > 0 && (
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tax <span className="text-[10px] uppercase">(prorated)</span></span>
              <span className="font-semibold tabular-nums">৳{tax.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t pt-2 text-base">
            <span className="font-semibold">Total refund</span>
            <span className="font-bold tabular-nums text-primary">৳{totalRefund.toFixed(2)}</span>
          </div>
          {(saleDiscount > 0 || saleTax > 0) && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Original sale had {saleDiscount > 0 ? `discount ৳${saleDiscount.toFixed(2)}` : ""}
              {saleDiscount > 0 && saleTax > 0 ? " · " : ""}
              {saleTax > 0 ? `tax ৳${saleTax.toFixed(2)}` : ""} — applied proportionally.
            </p>
          )}
          {errors.items && <p className="mt-2 text-xs font-medium text-rose-600">{errors.items}</p>}
          <Button className="mt-4 w-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Saving..." : "Create return"}
          </Button>
        </div>
      </div>
    </div>

    <Dialog
      open={!!restockedModal}
      onOpenChange={(o) => {
        if (!o) {
          setRestockedModal(null);
          navigate({ to: "/admin/sales-returns" });
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <PackageCheck className="h-4 w-4" />
            </span>
            Restocked items
          </DialogTitle>
          <DialogDescription>
            {restockedModal?.length ?? 0} item{(restockedModal?.length ?? 0) > 1 ? "s" : ""} returned to inventory.
          </DialogDescription>
        </DialogHeader>
        {restockedModal && restockedModal.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <PackageOpen className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">No restocked line items to view</p>
            <p className="text-xs text-muted-foreground">Nothing was returned to inventory for this sales return.</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                  <th className="px-3 py-2 text-right font-semibold">Line total</th>
                </tr>
              </thead>
              <tbody>
                {restockedModal?.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">×{r.quantity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">৳{r.unit_price.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">৳{(r.quantity * r.unit_price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30">
                <tr>
                  <td className="px-3 py-2 font-semibold" colSpan={1}>Total</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    ×{restockedModal!.reduce((s, r) => s + r.quantity, 0)}
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">
                    ৳{restockedModal!.reduce((s, r) => s + r.quantity * r.unit_price, 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRestockedModal(null);
              create.reset();
            }}
          >
            Confirm
          </Button>
          <Button
            onClick={() => {
              setRestockedModal(null);
              create.reset();
              navigate({ to: "/admin/sales-returns" });
            }}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
