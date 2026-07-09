import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUnits, updateUnit } from "@/lib/catalog.functions";
import { UnitForm, type UnitFormValues } from "@/components/admin/UnitForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/units/$id/edit")({ component: EditUnitPage });

function EditUnitPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listUnits);
  const updateFn = useServerFn(updateUnit);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-units"], queryFn: () => listFn() });
  const row = (rows as any[]).find((c) => c.id === id);
  const m = useMutation({
    mutationFn: (v: UnitFormValues) =>
      updateFn({ data: { id, name: v.name, symbol: v.symbol || null, description: v.description || null, is_active: v.is_active } as any }),
    onSuccess: () => { toast.success("Unit updated"); qc.invalidateQueries({ queryKey: ["admin-units"] }); navigate({ to: "/admin/units" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!row) return <div className="text-muted-foreground">Unit not found.</div>;
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Edit unit</h2>
      <UnitForm
        initial={{ name: row.name ?? "", symbol: row.symbol ?? "", description: row.description ?? "", is_active: row.is_active ?? true }}
        submitLabel="Save"
        submitting={m.isPending}
        onSubmit={(v) => m.mutate(v)}
      />
    </div>
  );
}
