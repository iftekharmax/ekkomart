import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export type UnitFormValues = {
  name: string;
  symbol: string;
  description: string;
  is_active: boolean;
};

export function UnitForm({
  initial, submitLabel, submitting, onSubmit,
}: {
  initial: UnitFormValues; submitLabel: string; submitting?: boolean;
  onSubmit: (v: UnitFormValues) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<UnitFormValues>(initial);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSubmit(form); }}
      className="max-w-2xl rounded-2xl border bg-card p-6"
    >
      <div className="grid gap-4">
        <div>
          <Label>Unit Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Kilogram" />
        </div>
        <div>
          <Label>Short Name</Label>
          <Input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="kg" />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional description" />
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          <Label>Active</Label>
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button type="submit" disabled={submitting}>{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/units" })}>Cancel</Button>
      </div>
    </form>
  );
}
