import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, listSubcategories, deleteSubcategory } from "@/lib/taxonomy.functions";
import { removeStoredImage } from "@/lib/storage-utils";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/subcategories/")({
  component: SubcategoriesListPage,
});

function SubcategoriesListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listCatsFn = useServerFn(listCategories);
  const listSubsFn = useServerFn(listSubcategories);
  const deleteFn = useServerFn(deleteSubcategory);

  const [filter, setFilter] = useState<string>("");
  const { data: cats = [] } = useQuery({ queryKey: ["admin-categories"], queryFn: () => listCatsFn() });
  const { data: subs = [] } = useQuery({
    queryKey: ["admin-subcategories", filter],
    queryFn: () => listSubsFn({ data: filter ? { category_id: filter } : {} } as any),
  });

  const deleteM = useMutation({
    mutationFn: async (row: { id: string; image_url?: string | null }) => {
      await deleteFn({ data: { id: row.id } });
      await removeStoredImage(row.image_url);
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-subcategories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const catName = (id: string) => (cats as any[]).find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Sub Categories</h2>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {(cats as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button onClick={() => navigate({ to: "/admin/subcategories/new" })} disabled={!cats.length}>
            <Plus className="mr-1 h-4 w-4" /> New sub category
          </Button>
        </div>
      </div>

      {!cats.length && (
        <div className="mb-4 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
          Create a category first before adding sub categories.
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(subs as any[]).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3">
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.name} className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{s.name}</td>

                <td className="px-4 py-3 text-muted-foreground">{catName(s.category_id)}</td>
                <td className="px-4 py-3 text-muted-foreground">{s.slug}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link to="/admin/subcategories/$id/edit" params={{ id: s.id }}>
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                    <button onClick={() => confirm("Delete this sub category?") && deleteM.mutate({ id: s.id, image_url: s.image_url })}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {subs.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No sub categories.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
