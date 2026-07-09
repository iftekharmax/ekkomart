import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBrands, updateBrand } from "@/lib/catalog.functions";
import { BrandForm } from "@/components/admin/BrandForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/brands/$id/edit")({ component: EditBrandPage });

function EditBrandPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listBrands);
  const updateFn = useServerFn(updateBrand);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-brands"], queryFn: () => listFn() });
  const row = (rows as any[]).find((c) => c.id === id);
  const m = useMutation({
    mutationFn: (v: { name: string; description: string; image_url: string }) =>
      updateFn({ data: { id, name: v.name, description: v.description || null, image_url: v.image_url || null } as any }),
    onSuccess: () => { toast.success("Brand updated"); qc.invalidateQueries({ queryKey: ["admin-brands"] }); navigate({ to: "/admin/brands" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!row) return <div className="text-muted-foreground">Brand not found.</div>;
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Edit brand</h2>
      <BrandForm initial={{ name: row.name ?? "", description: row.description ?? "", image_url: row.image_url ?? "" }}
        submitLabel="Save" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
