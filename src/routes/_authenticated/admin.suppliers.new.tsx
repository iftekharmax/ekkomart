import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createSupplier } from "@/lib/catalog.functions";
import { SupplierForm, type SupplierFormValues } from "@/components/admin/SupplierForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/suppliers/new")({ component: NewSupplierPage });

function NewSupplierPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createSupplier);
  const m = useMutation({
    mutationFn: (v: SupplierFormValues) => createFn({ data: {
      name: v.name, contact_name: v.contact_name || null, email: v.email || null, phone: v.phone || null,
      address: v.address || null, description: v.description || null, image_url: v.image_url || null, is_active: v.is_active,
    } as any }),
    onSuccess: () => { toast.success("Supplier created"); qc.invalidateQueries({ queryKey: ["admin-suppliers"] }); navigate({ to: "/admin/suppliers" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">New supplier</h2>
      <SupplierForm initial={{ name: "", contact_name: "", email: "", phone: "", address: "", description: "", image_url: "", is_active: true }}
        submitLabel="Create" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
