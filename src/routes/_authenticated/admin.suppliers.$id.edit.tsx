import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSuppliers, updateSupplier } from "@/lib/catalog.functions";
import { SupplierForm, type SupplierFormValues } from "@/components/admin/SupplierForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/suppliers/$id/edit")({ component: EditSupplierPage });

function EditSupplierPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listSuppliers);
  const updateFn = useServerFn(updateSupplier);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-suppliers"], queryFn: () => listFn() });
  const row = (rows as any[]).find((r) => r.id === id);
  const m = useMutation({
    mutationFn: (v: SupplierFormValues) => updateFn({ data: {
      id, name: v.name, contact_name: v.contact_name || null, email: v.email || null, phone: v.phone || null,
      address: v.address || null, description: v.description || null, image_url: v.image_url || null, is_active: v.is_active,
    } as any }),
    onSuccess: () => { toast.success("Supplier updated"); qc.invalidateQueries({ queryKey: ["admin-suppliers"] }); navigate({ to: "/admin/suppliers" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!row) return <div className="text-muted-foreground">Supplier not found.</div>;
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Edit supplier</h2>
      <SupplierForm initial={{
        name: row.name ?? "", contact_name: row.contact_name ?? "", email: row.email ?? "", phone: row.phone ?? "",
        address: row.address ?? "", description: row.description ?? "", image_url: row.image_url ?? "", is_active: row.is_active ?? true,
      }} submitLabel="Save" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
