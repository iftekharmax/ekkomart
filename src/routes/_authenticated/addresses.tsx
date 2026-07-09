import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, MapPin, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/addresses")({
  head: () => ({ meta: [{ title: "Addresses — Tokyohalal" }] }),
  component: AddressesPage,
});

type Address = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  phone: string | null;
  is_default: boolean;
};

function AddressesPage() {
  const [list, setList] = useState<Address[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "Home", line1: "", line2: "", city: "", phone: "" });

  const load = async () => {
    const { data } = await supabase.from("addresses").select("*").order("created_at", { ascending: false });
    setList((data as Address[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("addresses").insert({
      user_id: userData.user.id,
      label: form.label,
      line1: form.line1,
      line2: form.line2 || null,
      city: form.city,
      phone: form.phone || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Address added");
    setForm({ label: "Home", line1: "", line2: "", city: "", phone: "" });
    setShowForm(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("addresses").delete().eq("id", id);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/profile" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Addresses</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-2xl border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Address line 1</Label><Input required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} /></div>
          <div><Label>Address line 2</Label><Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></div>
          <div><Label>City</Label><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <Button type="submit" className="w-full">Save address</Button>
        </form>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No addresses yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="flex items-start justify-between rounded-2xl border bg-card p-4">
              <div>
                <p className="text-sm font-bold">{a.label}</p>
                <p className="text-sm">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
                <p className="text-sm text-muted-foreground">{a.city}{a.phone ? ` · ${a.phone}` : ""}</p>
              </div>
              <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
