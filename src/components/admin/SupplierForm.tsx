import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { uploadImage, removeStoredImage } from "@/lib/cpanel-storage";

export type SupplierFormValues = {
  name: string; contact_name: string; email: string; phone: string;
  address: string; description: string; image_url: string; is_active: boolean;
};

export function SupplierForm({ initial, submitLabel, submitting, onSubmit }: {
  initial: SupplierFormValues; submitLabel: string; submitting?: boolean;
  onSubmit: (v: SupplierFormValues) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<SupplierFormValues>(initial);
  const [uploading, setUploading] = useState(false);

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadImage(file, "suppliers");
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

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form); }}
      className="max-w-2xl rounded-2xl border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Contact person</Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="flex items-center gap-3">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          <Label>Active</Label>
        </div>
        <div className="sm:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <Label>Image</Label>
          <div className="mt-1 flex items-center gap-3">
            {form.image_url ? (
              <div className="relative">
                <img src={form.image_url} alt="preview" className="h-24 w-24 rounded object-cover" />
                <button type="button" onClick={async () => { const prev = form.image_url; setForm({ ...form, image_url: "" }); await removeStoredImage(prev); }}
                  className="absolute -right-2 -top-2 rounded-full bg-background border p-1"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed text-xs text-muted-foreground hover:bg-muted">
                <Upload className="mb-1 h-4 w-4" />{uploading ? "Uploading…" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadM.mutate(f); }} disabled={uploading} />
              </label>
            )}
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button type="submit" disabled={submitting || uploading}>{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/suppliers" })}>Cancel</Button>
      </div>
    </form>
  );
}
