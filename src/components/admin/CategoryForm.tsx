import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { uploadImage, removeStoredImage } from "@/lib/cpanel-storage";

export type CategoryFormValues = {
  name: string;
  description: string;
  image_url: string;
};

export function CategoryForm({
  initial,
  submitLabel,
  onSubmit,
  submitting,
}: {
  initial: CategoryFormValues;
  submitLabel: string;
  onSubmit: (v: CategoryFormValues) => void;
  submitting?: boolean;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<CategoryFormValues>(initial);
  const [uploading, setUploading] = useState(false);

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadImage(file, "categories");
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
          <Label>Name</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Category name"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional description"
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
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/categories" })}>Cancel</Button>
      </div>
    </form>
  );
}
