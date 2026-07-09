import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createAttribute } from "@/lib/catalog.functions";
import { AttributeForm, type AttributeFormValues } from "@/components/admin/AttributeForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/attributes/new")({ component: NewAttrPage });

function NewAttrPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createAttribute);
  const m = useMutation({
    mutationFn: (v: AttributeFormValues) => createFn({ data: { name: v.name, description: v.description || null, values: v.values } as any }),
    onSuccess: () => { toast.success("Attribute created"); qc.invalidateQueries({ queryKey: ["admin-attributes"] }); navigate({ to: "/admin/attributes" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">New attribute</h2>
      <AttributeForm initial={{ name: "", description: "", values: [] }} submitLabel="Create" submitting={m.isPending} onSubmit={(v) => m.mutate(v)} />
    </div>
  );
}
