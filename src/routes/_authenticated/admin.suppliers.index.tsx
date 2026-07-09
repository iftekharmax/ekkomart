import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSuppliers, deleteSupplier } from "@/lib/catalog.functions";
import { removeStoredImage } from "@/lib/storage-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/suppliers/")({ component: SuppliersListPage });

function SuppliersListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listSuppliers);
  const deleteFn = useServerFn(deleteSupplier);
  const [q, setQ] = useState("");
  const { data: rows = [] } = useQuery({ queryKey: ["admin-suppliers"], queryFn: () => listFn() });
  const deleteM = useMutation({
    mutationFn: async (row: { id: string; image_url?: string | null }) => {
      await deleteFn({ data: { id: row.id } });
      await removeStoredImage(row.image_url);
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-suppliers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows as any[];
    return (rows as any[]).filter((r) => [r.name, r.contact_name, r.email, r.phone].some((v) => (v ?? "").toString().toLowerCase().includes(s)));
  }, [rows, q]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Suppliers</h2>
        <Button onClick={() => navigate({ to: "/admin/suppliers/new" })}><Plus className="mr-1 h-4 w-4" /> New supplier</Button>
      </div>
      <div className="mb-4 max-w-sm"><Input placeholder="Search suppliers…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Image</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3">{r.image_url ? <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-muted" />}</td>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.contact_name ?? "—"}{r.email ? ` · ${r.email}` : ""}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{r.is_active ? "Active" : "Inactive"}</span></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link to="/admin/suppliers/$id/edit" params={{ id: r.id }}><Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" /></Link>
                    <button onClick={() => confirm("Delete this supplier?") && deleteM.mutate({ id: r.id, image_url: r.image_url })}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (<tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No suppliers.</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
