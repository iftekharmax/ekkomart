import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createPurchase } from "@/lib/purchases.functions";
import { listProducts, listAllVariations } from "@/lib/products.functions";
import { listSuppliers, createSupplier } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/purchases/new")({
  head: () => ({ meta: [{ title: "New Purchase — Admin" }] }),
  component: NewPurchasePage,
});

type Line = { product_id: string; variation_id: string | null; label: string; quantity: number; unit_cost: number };

function NewPurchasePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const suppliersFn = useServerFn(listSuppliers);
  const productsFn = useServerFn(listProducts);
  const variationsFn = useServerFn(listAllVariations);
  const createFn = useServerFn(createPurchase);
  const createSupplierFn = useServerFn(createSupplier);

  const { data: suppliers = [] } = useQuery({ queryKey: ["admin-suppliers"], queryFn: () => suppliersFn() });
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: () => productsFn() });
  const { data: variations = [] } = useQuery({ queryKey: ["admin-all-variations"], queryFn: () => variationsFn() });

  const [supplierId, setSupplierId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [paid, setPaid] = useState(0);
  const [items, setItems] = useState<Line[]>([]);

  const [barcode, setBarcode] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const suggestions = (() => {
    const q = barcode.trim().toLowerCase();
    if (!q) return [] as Array<{ key: string; label: string; sub: string; add: () => void }>;
    const out: Array<{ key: string; label: string; sub: string; add: () => void }> = [];
    for (const v of variations as any[]) {
      if (out.length >= 8) break;
      const hay = `${v.name ?? ""} ${v.barcode ?? ""} ${v.sku ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
      const p = (products as any[]).find((x) => x.id === v.product_id);
      if (!p) continue;
      out.push({
        key: `v-${v.id}`,
        label: `${p.name} — ${v.name}`,
        sub: `${v.barcode ?? v.sku ?? ""}`,
        add: () => scanBarcode(v.barcode || v.sku || ""),
      });
    }
    for (const p of products as any[]) {
      if (out.length >= 8) break;
      if (p.product_type === "variable") continue;
      const hay = `${p.name ?? ""} ${p.barcode ?? ""} ${p.sku ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({
        key: `p-${p.id}`,
        label: p.name,
        sub: `${p.barcode ?? p.sku ?? ""}`,
        add: () => scanBarcode(p.barcode || p.sku || ""),
      });
    }
    return out;
  })();

  const scanBarcode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const variation = (variations as any[]).find((v) => (v.barcode ?? "") === code || (v.sku ?? "") === code);
    let product: any; let variationId: string | null = null; let label = "";
    if (variation) {
      product = (products as any[]).find((p) => p.id === variation.product_id);
      if (!product) { toast.error("Variation's product not found"); return; }
      variationId = variation.id;
      label = `${product.name} — ${variation.name}`;
    } else {
      product = (products as any[]).find((p) => (p.barcode ?? "") === code || (p.sku ?? "") === code);
      if (!product) { toast.error(`No product for barcode ${code}`); return; }
      if (product.product_type === "variable") { toast.error("Scan a variation barcode for variable product"); return; }
      label = product.name;
    }
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === product.id && i.variation_id === variationId);
      if (idx >= 0) return prev.map((p, i) => i === idx ? { ...p, quantity: p.quantity + 1 } : p);
      return [...prev, { product_id: product.id, variation_id: variationId, label, quantity: 1, unit_cost: 0 }];
    });
    setBarcode("");
  };

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0);
  const total = subtotal - discount + tax + shipping;

  const m = useMutation({
    mutationFn: () => createFn({ data: {
      supplier_id: supplierId || null,
      purchase_date: date, note: note || null,
      reference: reference.trim() || null,
      discount, tax, shipping, paid, status: "received",
      items: items.filter((i) => i.product_id && i.quantity > 0).map((i) => ({
        product_id: i.product_id, variation_id: i.variation_id || null,
        quantity: Number(i.quantity), unit_cost: Number(i.unit_cost),
      })),
    } as any }),
    onSuccess: () => {
      toast.success("Purchase recorded — stock updated");
      qc.invalidateQueries({ queryKey: ["admin-purchases"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-all-variations"] });
      navigate({ to: "/admin/purchases" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Supplier modal
  const [supOpen, setSupOpen] = useState(false);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supContact, setSupContact] = useState("");
  const supM = useMutation({
    mutationFn: () => createSupplierFn({ data: {
      name: supName, contact_name: supContact || null, phone: supPhone || null,
      email: null, address: null, description: null, image_url: null, is_active: true,
    } as any }),
    onSuccess: async (row: any) => {
      toast.success("Supplier added");
      await qc.invalidateQueries({ queryKey: ["admin-suppliers"] });
      setSupplierId(row.id);
      setSupOpen(false);
      setSupName(""); setSupPhone(""); setSupContact("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl">
      <h2 className="mb-6 text-2xl font-bold">New purchase</h2>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <Label>Supplier</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {(suppliers as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setSupOpen(true)} title="Add supplier">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label>Purchase date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Invoice No.</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto-generate if empty" />
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-6">
        <div className="mb-3">
          <Label>Scan or type barcode</Label>
          <div className="relative">
            <Input
              ref={barcodeRef}
              autoFocus
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); scanBarcode(barcode); } }}
              placeholder="Scan barcode with POS scanner or type and press Enter"
            />
            {suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-md">
                {suggestions.map((s) => (
                  <button type="button" key={s.key}
                    onClick={() => { s.add(); barcodeRef.current?.focus(); }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent">
                    <span>{s.label}</span>
                    <span className="text-xs text-muted-foreground">{s.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Type to search or scan; variation barcode auto-selects the variation.</p>
        </div>


        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No items yet. Scan a barcode to add.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-[1fr_100px_140px_140px_auto] gap-2 text-xs font-medium text-muted-foreground px-2">
              <div>Product</div><div>Qty</div><div>Unit cost</div><div>Line total</div><div></div>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="rounded-lg border p-3 md:grid md:grid-cols-[1fr_100px_140px_140px_auto] md:gap-2 md:p-2 md:items-center">
                <div className="mb-2 flex items-start justify-between gap-2 md:mb-0 md:block">
                  <div className="text-sm font-medium md:font-normal">{it.label}</div>
                  <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 md:contents">
                  <div className="md:contents">
                    <Label className="text-xs text-muted-foreground md:hidden">Qty</Label>
                    <Input type="number" min={1} value={it.quantity}
                      onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, quantity: Number(e.target.value) || 0 } : p))} />
                  </div>
                  <div className="md:contents">
                    <Label className="text-xs text-muted-foreground md:hidden">Unit cost</Label>
                    <Input type="number" min={0} step="0.01" value={it.unit_cost}
                      onChange={(e) => setItems((prev) => prev.map((p, i) => i === idx ? { ...p, unit_cost: Number(e.target.value) || 0 } : p))} />
                  </div>
                  <div className="md:contents">
                    <Label className="text-xs text-muted-foreground md:hidden">Total</Label>
                    <Input disabled value={`$${(it.quantity * it.unit_cost).toFixed(2)}`} />
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <Label>Notes / description</Label>
          <Textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-3">
          <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
          <FieldRow label="Discount" value={discount} onChange={setDiscount} />
          <FieldRow label="Tax" value={tax} onChange={setTax} />
          <FieldRow label="Shipping" value={shipping} onChange={setShipping} />
          <FieldRow label="Paid" value={paid} onChange={setPaid} />
          <div className="mt-2 flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between text-sm font-semibold ${(total - paid) > 0 ? "text-destructive" : "text-green-600"}`}>
            <span>Due</span><span>${Math.max(0, total - paid).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/admin/purchases" })}>Cancel</Button>
        <Button onClick={() => m.mutate()} disabled={m.isPending || items.length === 0}>
          {m.isPending ? "Saving…" : "Save purchase"}
        </Button>
      </div>

      <Dialog open={supOpen} onOpenChange={setSupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add supplier</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name *</Label><Input value={supName} onChange={(e) => setSupName(e.target.value)} autoFocus /></div>
            <div><Label>Contact person</Label><Input value={supContact} onChange={(e) => setSupContact(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={supPhone} onChange={(e) => setSupPhone(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupOpen(false)}>Cancel</Button>
            <Button onClick={() => supName.trim() && supM.mutate()} disabled={supM.isPending || !supName.trim()}>
              {supM.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

function FieldRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Input type="number" min={0} step="0.01" className="w-32 text-right" value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
