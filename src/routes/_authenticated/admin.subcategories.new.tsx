import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createSubcategory } from "@/lib/taxonomy.functions";
import { SubcategoryForm } from "@/components/admin/SubcategoryForm";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/subcategories/new")({
  component: NewSubcategoryPage,
});

function NewSubcategoryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createSubcategory);

  const m = useMutation({
    mutationFn: (v: { category_id: string; name: string; description: string; image_url: string }) =>
      createFn({
        data: {
          category_id: v.category_id,
          name: v.name,
          description: v.description || null,
          image_url: v.image_url || null,
          sort_order: 0,
        } as any,
      }),
    onSuccess: () => {
      toast.success("Sub category created");
      qc.invalidateQueries({ queryKey: ["admin-subcategories"] });
      navigate({ to: "/admin/subcategories" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold">New sub category</h2>
      <SubcategoryForm
        initial={{ category_id: "", name: "", description: "", image_url: "" }}

        submitLabel="Create"
        submitting={m.isPending}
        onSubmit={(v) => {
          if (!v.category_id) return toast.error("Pick a parent category");
          m.mutate(v);
        }}
      />
    </div>
  );
}
