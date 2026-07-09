import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, deleteCategory } from "@/lib/taxonomy.functions";
import { removeStoredImage } from "@/lib/storage-utils";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/categories/")({
  component: CategoriesListPage,
});

function CategoriesListPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const deleteFn = useServerFn(deleteCategory);
  const navigate = useNavigate();

  const { data: rows = [] } = useQuery({ queryKey: ["admin-categories"], queryFn: () => listFn() });

  const deleteM = useMutation({
    mutationFn: async (row: { id: string; image_url?: string | null }) => {
      await deleteFn({ data: { id: row.id } });
      await removeStoredImage(row.image_url);
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["admin-subcategories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Categories</h2>
        <Button onClick={() => navigate({ to: "/admin/categories/new" })}>
          <Plus className="mr-1 h-4 w-4" /> New category
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(rows as any[]).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.name} className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link to="/admin/categories/$id/edit" params={{ id: c.id }}>
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                    <button onClick={() => confirm("Delete this category?") && deleteM.mutate({ id: c.id, image_url: c.image_url })}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">No categories yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
