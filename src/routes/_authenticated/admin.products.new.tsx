import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createProduct } from "@/lib/products.functions";
import { ProductForm, emptyProduct, toProductPayload, type ProductFormValues } from "@/components/admin/ProductForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/products/new")({ component: NewProductPage });

function NewProductPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createProduct);
  const m = useMutation({
    mutationFn: (v: ProductFormValues) => createFn({ data: toProductPayload(v) as any }),
    onSuccess: () => {
      toast.success("Product created");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      navigate({ to: "/admin/products" });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">New product</h2>
      <ProductForm initial={emptyProduct} submitLabel="Create" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
