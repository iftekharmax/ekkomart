import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createPurchase } from "@/lib/purchases.functions";
import { listProducts, listVariations } from "@/lib/products.functions";
import { listSuppliers } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/purchases/new")({
  head: () => ({ meta: [{ title: "New Purchase — Admin" }] }),
  component: NewPurchasePage,
});

type Line = { product_id: string; variation_id: string | null; quantity: number; unit_cost: number };

function NewPurchasePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const suppliersFn = useServerFn(listSuppliers);
  const productsFn = useServerFn(listProducts);
  const createFn = useServerFn(createPurchase);

  const { data: suppliers = [] } = useQuery({ queryKey: ["admin-suppliers"], queryFn: () => suppliersFn() });
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: () => productsFn() });

  const [supplierId, setSupplierId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [paid, setPaid] = useState(0);
  const [items, setItems] = useState<Line[]>([{ product_id: "", variation_id: null, quantity: 1, unit_cost: 0 }]);

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0);
  const total = subtotal - discount + tax + shipping;

  const m = useMutation({
    mutationFn: () => createFn({ data: {
      supplier_id: supplierId || null,
      purchase_date: date, note: note || null,
      discount, tax, shipping, paid, status: "received",
      items: items.filter((i) => i.product_id && i.quantity > 0).map((i) => ({
        product_id: i.product_id,
        variation_id: i.variation_id || null,
        quantity: Number(i.quantity),
        unit_cost: Number(i.unit_cost),
      })),
    } as any }),
    onSuccess: () => {
      toast.success("Purchase recorded — stock updated");
      qc.invalidateQueries({ queryKey: ["admin-purchases"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      navigate({ to: "/admin/purchases" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-5xl">
      <h2 className="mb-6 text-2xl font-bold">New purchase</h2>

      <div className="grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-3">
        <div>
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
            <SelectContent>
              {(suppliers as any[]).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Purchase date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="md:col-span-1">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Items</h3>
          <Button size="sm" variant="outline" onClick={() =>
            setItems((prev) => [...prev, { product_id: "", variation_id: null, quantity: 1, unit_cost: 0 }])
          }><Plus className="mr-1 h-4 w-4" /> Add row</Button>
        </div>
        <div className="space-y-3">
          {items.map((it, idx) => (
            <ItemRow key={idx} value={it} products={products as any[]}
              onChange={(v) => setItems((prev) => prev.map((p, i) => i === idx ? v : p))}
              onRemove={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
              canRemove={items.length > 1}
            />
          ))}
        </div>
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
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/admin/purchases" })}>Cancel</Button>
        <Button onClick={() => m.mutate()} disabled={m.isPending || !items.some((i) => i.product_id)}>
          {m.isPending ? "Saving…" : "Save purchase"}
        </Button>
      </div>
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

function ItemRow({ value, products, onChange, onRemove, canRemove }: {
  value: Line; products: any[]; onChange: (v: Line) => void; onRemove: () => void; canRemove: boolean;
}) {
  const varsFn = useServerFn(listVariations);
  const product = useMemo(() => products.find((p) => p.id === value.product_id), [products, value.product_id]);
  const isVariable = product?.product_type === "variable";
  const { data: variations = [] } = useQuery({
    queryKey: ["variations", value.product_id],
    queryFn: () => varsFn({ data: { product_id: value.product_id } }),
    enabled: !!value.product_id && isVariable,
  });

  return (
    <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-[2fr_1.5fr_100px_120px_120px_auto] md:items-end">
      <div>
        <Label className="text-xs">Product</Label>
        <Select value={value.product_id} onValueChange={(v) => onChange({ ...value, product_id: v, variation_id: null })}>
          <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}{p.product_type === "variable" ? " (variable)" : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Variation</Label>
        {isVariable ? (
          <Select value={value.variation_id ?? ""} onValueChange={(v) => onChange({ ...value, variation_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select variation" /></SelectTrigger>
            <SelectContent>
              {(variations as any[]).map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name} (stock {v.stock ?? 0})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input disabled value="—" />
        )}
      </div>
      <div>
        <Label className="text-xs">Qty</Label>
        <Input type="number" min={1} value={value.quantity}
          onChange={(e) => onChange({ ...value, quantity: Number(e.target.value) || 0 })} />
      </div>
      <div>
        <Label className="text-xs">Unit cost</Label>
        <Input type="number" min={0} step="0.01" value={value.unit_cost}
          onChange={(e) => onChange({ ...value, unit_cost: Number(e.target.value) || 0 })} />
      </div>
      <div>
        <Label className="text-xs">Line total</Label>
        <Input disabled value={`$${(value.quantity * value.unit_cost).toFixed(2)}`} />
      </div>
      <div>
        <Button variant="ghost" size="icon" onClick={onRemove} disabled={!canRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
