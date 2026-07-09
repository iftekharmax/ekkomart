import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSubcategories, updateSubcategory } from "@/lib/taxonomy.functions";
import { SubcategoryForm } from "@/components/admin/SubcategoryForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/subcategories/$id/edit")({
  component: EditSubcategoryPage,
});

function EditSubcategoryPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listSubcategories);
  const updateFn = useServerFn(updateSubcategory);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-subcategories", ""],
    queryFn: () => listFn({ data: {} } as any),
  });
  const row = (rows as any[]).find((s) => s.id === id);

  const m = useMutation({
    mutationFn: (v: { category_id: string; name: string; description: string; image_url: string }) =>
      updateFn({
        data: {
          id,
          category_id: v.category_id,
          name: v.name,
          description: v.description || null,
          image_url: v.image_url || null,
          sort_order: row?.sort_order ?? 0,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Sub category updated");
      qc.invalidateQueries({ queryKey: ["admin-subcategories"] });
      navigate({ to: "/admin/subcategories" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!row) return <div className="text-muted-foreground">Sub category not found.</div>;

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Edit sub category</h2>
      <SubcategoryForm
        initial={{
          category_id: row.category_id ?? "",
          name: row.name ?? "",
          description: row.description ?? "",
          image_url: row.image_url ?? "",
        }}

        submitLabel="Save"
        submitting={m.isPending}
        onSubmit={(v) => m.mutate(v)}
      />
    </div>
  );
}
