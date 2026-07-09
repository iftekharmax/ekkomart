import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAttributes, updateAttribute } from "@/lib/catalog.functions";
import { AttributeForm, type AttributeFormValues } from "@/components/admin/AttributeForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/attributes/$id/edit")({ component: EditAttrPage });

function EditAttrPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listAttributes);
  const updateFn = useServerFn(updateAttribute);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["admin-attributes"], queryFn: () => listFn() });
  const row = (rows as any[]).find((c) => c.id === id);
  const m = useMutation({
    mutationFn: (v: AttributeFormValues) => updateFn({ data: { id, name: v.name, description: v.description || null, values: v.values } as any }),
    onSuccess: () => { toast.success("Attribute updated"); qc.invalidateQueries({ queryKey: ["admin-attributes"] }); navigate({ to: "/admin/attributes" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!row) return <div className="text-muted-foreground">Attribute not found.</div>;
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Edit attribute</h2>
      <AttributeForm
        initial={{ name: row.name ?? "", description: row.description ?? "", values: row.values ?? [] }}
        submitLabel="Save"
        submitting={m.isPending}
        onSubmit={(v) => m.mutate(v)}
      />
    </div>
  );
}
