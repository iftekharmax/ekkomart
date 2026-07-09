import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories } from "@/lib/taxonomy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { uploadImage, removeStoredImage } from "@/lib/cpanel-storage";

export type SubcategoryFormValues = {
  category_id: string;
  name: string;
  description: string;
  image_url: string;
};

export function SubcategoryForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial: SubcategoryFormValues;
  submitLabel: string;
  onSubmit: (v: SubcategoryFormValues) => void;
  submitting?: boolean;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<SubcategoryFormValues>(initial);
  const [uploading, setUploading] = useState(false);
  const listCatsFn = useServerFn(listCategories);
  const { data: cats = [] } = useQuery({ queryKey: ["admin-categories"], queryFn: () => listCatsFn() });

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadImage(file, "subcategories");
      return { url, previous: form.image_url };
    },
    onMutate: () => setUploading(true),
    onSettled: () => setUploading(false),
    onSuccess: async ({ url, previous }) => {
      setForm((f) => ({ ...f, image_url: url }));
      if (previous && previous !== url) await removeStoredImage(previous);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadM.mutate(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="max-w-2xl rounded-2xl border bg-card p-6">
      <div className="grid gap-4">
        <div>
          <Label>Parent category</Label>
          <select
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">Select…</option>
            {(cats as any[]).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Name</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <Label>Image</Label>
          <div className="mt-1 flex items-center gap-3">
            {form.image_url ? (
              <div className="relative">
                <img src={form.image_url} alt="preview" className="h-24 w-24 rounded object-cover" />
                <button
                  type="button"
                  onClick={async () => {
                    const prev = form.image_url;
                    setForm({ ...form, image_url: "" });
                    await removeStoredImage(prev);
                  }}
                  className="absolute -right-2 -top-2 rounded-full bg-background border p-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed text-xs text-muted-foreground hover:bg-muted">
                <Upload className="mb-1 h-4 w-4" />
                {uploading ? "Uploading…" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        <Button type="submit" disabled={submitting || uploading}>{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/subcategories" })}>Cancel</Button>
      </div>
    </form>
  );
}
