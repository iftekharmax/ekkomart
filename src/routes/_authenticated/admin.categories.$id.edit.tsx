import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, updateCategory } from "@/lib/taxonomy.functions";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/categories/$id/edit")({
  component: EditCategoryPage,
});

function EditCategoryPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listCategories);
  const updateFn = useServerFn(updateCategory);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => listFn(),
  });
  const row = (rows as any[]).find((c) => c.id === id);

  const m = useMutation({
    mutationFn: (v: { name: string; description: string; image_url: string }) =>
      updateFn({
        data: {
          id,
          name: v.name,
          description: v.description || null,
          image_url: v.image_url || null,
          sort_order: row?.sort_order ?? 0,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Category updated");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      navigate({ to: "/admin/categories" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Loading…</div>;
  if (!row) return <div className="text-muted-foreground">Category not found.</div>;

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">Edit category</h2>
      <CategoryForm
        initial={{
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
