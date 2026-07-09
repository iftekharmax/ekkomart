import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createBrand } from "@/lib/catalog.functions";
import { BrandForm } from "@/components/admin/BrandForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/brands/new")({ component: NewBrandPage });

function NewBrandPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createBrand);
  const m = useMutation({
    mutationFn: (v: { name: string; description: string; image_url: string }) =>
      createFn({ data: { name: v.name, description: v.description || null, image_url: v.image_url || null } as any }),
    onSuccess: () => { toast.success("Brand created"); qc.invalidateQueries({ queryKey: ["admin-brands"] }); navigate({ to: "/admin/brands" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">New brand</h2>
      <BrandForm initial={{ name: "", description: "", image_url: "" }} submitLabel="Create" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
