import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts, updateProduct, listVariations } from "@/lib/products.functions";
import { ProductForm, productRowToForm, toProductPayload, type ProductFormValues } from "@/components/admin/ProductForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products/$id/edit")({ component: EditProductPage });

function EditProductPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listProducts);
  const varsFn = useServerFn(listVariations);
  const updateFn = useServerFn(updateProduct);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-products"], queryFn: () => listFn() });
  const { data: variations = [], isLoading: vLoad } = useQuery({
    queryKey: ["admin-variations", id], queryFn: () => varsFn({ data: { product_id: id } }),
  });
  const row = (rows as any[]).find((p) => p.id === id);
  const m = useMutation({
    mutationFn: (v: ProductFormValues) => updateFn({ data: { id, ...toProductPayload(v) } as any }),
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-variations", id] });
      navigate({ to: "/admin/products" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading || vLoad) return <div className="text-muted-foreground">Loading…</div>;
  if (!row) return <div className="text-muted-foreground">Product not found.</div>;
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Edit product</h2>
      <ProductForm initial={productRowToForm(row, variations as any[])} submitLabel="Save" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
