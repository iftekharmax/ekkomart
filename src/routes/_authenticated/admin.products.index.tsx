import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, deleteProduct, listAllVariations } from "@/lib/products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products/")({ component: ProductsListPage });

function ProductsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listProducts);
  const varsFn = useServerFn(listAllVariations);
  const deleteFn = useServerFn(deleteProduct);
  const [q, setQ] = useState("");
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: () => listFn() });
  const { data: variations = [] } = useQuery({ queryKey: ["admin-all-variations"], queryFn: () => varsFn() });
  const stockByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of variations as any[]) m.set(v.product_id, (m.get(v.product_id) ?? 0) + Number(v.stock ?? 0));
    return m;
  }, [variations]);
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products as any[];
    return (products as any[]).filter((p) =>
      [p.name, p.sku, p.barcode, p.category, p.subcategory, p.brand].some((v) => (v ?? "").toString().toLowerCase().includes(s))
    );
  }, [products, q]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Products</h2>
        <Button onClick={() => navigate({ to: "/admin/products/new" })}><Plus className="mr-1 h-4 w-4" /> New product</Button>
      </div>
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3">
                  {p.img ? <img src={p.img} alt={p.name} className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}
                </td>
                <td className="px-4 py-3 font-medium">{p.name}<span className="ml-2 text-xs text-muted-foreground">{p.unit}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.sku}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.category}{p.subcategory ? ` / ${p.subcategory}` : ""}</td>
                <td className="px-4 py-3">${Number(p.price).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const stock = p.product_type === "variable" ? (stockByProduct.get(p.id) ?? 0) : Number(p.stock ?? 0);
                    return (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${stock > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {stock} {p.unit ?? ""}
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link to="/admin/products/$id/edit" params={{ id: p.id }}>
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                    <button onClick={() => confirm("Delete this product?") && deleteM.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">No products.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
