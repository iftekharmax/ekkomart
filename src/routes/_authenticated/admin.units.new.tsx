import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createUnit } from "@/lib/catalog.functions";
import { UnitForm, type UnitFormValues } from "@/components/admin/UnitForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/units/new")({ component: NewUnitPage });

function NewUnitPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createUnit);
  const m = useMutation({
    mutationFn: (v: UnitFormValues) =>
      createFn({ data: { name: v.name, symbol: v.symbol || null, description: v.description || null, is_active: v.is_active } as any }),
    onSuccess: () => { toast.success("Unit created"); qc.invalidateQueries({ queryKey: ["admin-units"] }); navigate({ to: "/admin/units" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">New unit</h2>
      <UnitForm initial={{ name: "", symbol: "", description: "", is_active: true }} submitLabel="Create" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
