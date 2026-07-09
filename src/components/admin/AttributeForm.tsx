import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

export type AttributeFormValues = { name: string; description: string; values: string[] };

export function AttributeForm({
  initial, submitLabel, submitting, onSubmit,
}: {
  initial: AttributeFormValues; submitLabel: string; submitting?: boolean;
  onSubmit: (v: AttributeFormValues) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<AttributeFormValues>(initial);
  const [val, setVal] = useState("");
  const addVal = () => {
    const v = val.trim();
    if (!v || form.values.includes(v)) return;
    setForm({ ...form, values: [...form.values, v] });
    setVal("");
  };
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form); }}
      className="max-w-2xl rounded-2xl border bg-card p-6"
    >
      <div className="grid gap-4">
        <div>
          <Label>Attribute Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Weight" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional description" />
        </div>
        <div>
          <Label>Values (add unlimited)</Label>
          <div className="flex gap-2">
            <Input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVal(); } }}
              placeholder="e.g. 500gm"
            />
            <Button type="button" variant="outline" onClick={addVal}>Add</Button>
          </div>
          {form.values.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {form.values.map((v) => (
                <span key={v} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  {v}
                  <button type="button" onClick={() => setForm({ ...form, values: form.values.filter((x) => x !== v) })}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button type="submit" disabled={submitting}>{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/attributes" })}>Cancel</Button>
      </div>
    </form>
  );
}
