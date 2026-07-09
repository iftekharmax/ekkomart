import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createCategory } from "@/lib/taxonomy.functions";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/categories/new")({
  component: NewCategoryPage,
});

function NewCategoryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createCategory);

  const m = useMutation({
    mutationFn: (v: { name: string; description: string; image_url: string }) =>
      createFn({
        data: {
          name: v.name,
          description: v.description || null,
          image_url: v.image_url || null,
          sort_order: 0,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Category created");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      navigate({ to: "/admin/categories" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">New category</h2>
      <CategoryForm
        initial={{ name: "", description: "", image_url: "" }}
        submitLabel="Create"
        submitting={m.isPending}
        onSubmit={(v) => m.mutate(v)}
      />
    </div>
  );
}
