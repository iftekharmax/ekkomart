import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdjustments, createAdjustment, deleteAdjustment } from "@/lib/stock-adjustments.functions";
import { listProducts, listAllVariations } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/stock-adjustments/")({ component: StockAdjustmentsPage });


function StockAdjustmentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdjustments);
  const prodFn = useServerFn(listProducts);
  const varsFn = useServerFn(listAllVariations);
  const createFn = useServerFn(createAdjustment);
  const deleteFn = useServerFn(deleteAdjustment);

  const { data: adjustments = [] } = useQuery({ queryKey: ["stock-adjustments"], queryFn: () => listFn() });
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: () => prodFn() });
  const { data: variations = [] } = useQuery({ queryKey: ["admin-all-variations"], queryFn: () => varsFn() });

  const [productId, setProductId] = useState<string>("");
  const [variationId, setVariationId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState("initial");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpenSearch(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);


  const selectedProduct = useMemo(
    () => (products as any[]).find((p) => p.id === productId) ?? null,
    [products, productId],
  );
  const productVariations = useMemo(
    () => (variations as any[]).filter((v) => v.product_id === productId),
    [variations, productId],
  );
  const isVariable = selectedProduct?.product_type === "variable";

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products as any[];
    if (!q) return list.slice(0, 50);
    return list.filter((p) =>
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q),
    ).slice(0, 50);
  }, [products, search]);

  const pickProduct = (p: any) => {
    setProductId(p.id);
    setVariationId("");
    setSearch(`${p.name}${p.barcode ? ` — ${p.barcode}` : ""}`);
    setOpenSearch(false);
  };

  // Auto-select on exact barcode/SKU match (barcode scanner friendly)
  useEffect(() => {
    const q = search.trim();
    if (!q || !openSearch) return;
    const exact = (products as any[]).find((p) => p.barcode === q || p.sku === q);
    if (exact && exact.id !== productId) pickProduct(exact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, products]);


  const parsed = useMemo(() => {
    if (!productId) return null;
    if (isVariable) {
      if (!variationId) return null;
      return { productId, variationId: variationId as string | null };
    }
    return { productId, variationId: null as string | null };
  }, [productId, variationId, isVariable]);

  const createM = useMutation({
    mutationFn: () => createFn({
      data: {
        product_id: parsed!.productId,
        variation_id: parsed!.variationId,
        quantity: Number(quantity),
        reason,
        note: note || null,
      },
    }),
    onSuccess: () => {
      toast.success("Stock adjusted");
      qc.invalidateQueries({ queryKey: ["stock-adjustments"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-all-variations"] });
      setQuantity(""); setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Adjustment reverted");
      qc.invalidateQueries({ queryKey: ["stock-adjustments"] });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-all-variations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = !!parsed && quantity !== "" && Number(quantity) !== 0;

  const rows = adjustments as any[];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Stock adjustments</h2>

      <div className="rounded-2xl border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">New adjustment</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={isVariable ? "" : "sm:col-span-2"} ref={searchRef}>
            <Label>Product (search by name or barcode)</Label>
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setOpenSearch(true); if (productId) { setProductId(""); setVariationId(""); } }}
                onFocus={() => setOpenSearch(true)}
                placeholder="Type or scan barcode…"
                autoComplete="off"
              />
              {openSearch && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover shadow-lg">
                  {filteredProducts.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No products found.</div>
                  )}
                  {filteredProducts.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => pickProduct(p)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="truncate">
                        {p.name}
                        {p.barcode ? <span className="ml-2 text-xs text-muted-foreground">#{p.barcode}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {p.product_type === "variable" ? "variable" : `stock: ${Number(p.stock ?? 0)}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isVariable && (
            <div>
              <Label>Variation</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={variationId}
                onChange={(e) => setVariationId(e.target.value)}
              >
                <option value="">Select variation…</option>
                {productVariations.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (stock: {Number(v.stock ?? 0)})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Quantity change (use negative to reduce)</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 50 or -3" />
          </div>
          <div>
            <Label>Reason</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="initial">Initial stock</option>
              <option value="recount">Recount</option>
              <option value="damage">Damage / Loss</option>
              <option value="return">Return</option>
              <option value="correction">Correction</option>
              <option value="manual">Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
          </div>
        </div>
        <div className="mt-4">
          <Button disabled={!canSubmit || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? "Saving…" : "Apply adjustment"}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Variation</th>
              <th className="px-4 py-3">Change</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-medium">{r.product?.name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.variation?.name ?? "—"}</td>
                <td className={`px-4 py-3 font-semibold ${r.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {r.quantity > 0 ? `+${r.quantity}` : r.quantity}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.reason}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.note ?? ""}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => confirm("Revert this adjustment? Stock will be reversed.") && deleteM.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No adjustments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
