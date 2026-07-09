import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUnits, deleteUnit } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/units/")({ component: UnitsListPage });

function UnitsListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const listFn = useServerFn(listUnits);
  const deleteFn = useServerFn(deleteUnit);
  const [q, setQ] = useState("");
  const { data: rows = [] } = useQuery({ queryKey: ["admin-units"], queryFn: () => listFn() });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-units"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows as any[];
    return (rows as any[]).filter((r) =>
      [r.name, r.symbol, r.description].some((v) => (v ?? "").toString().toLowerCase().includes(s))
    );
  }, [rows, q]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Units</h2>
        <Button onClick={() => navigate({ to: "/admin/units/new" })}><Plus className="mr-1 h-4 w-4" /> New unit</Button>
      </div>
      <div className="mb-4 max-w-sm">
        <Input placeholder="Search units…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Short name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.symbol ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.description ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link to="/admin/units/$id/edit" params={{ id: r.id }}><Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" /></Link>
                    <button onClick={() => confirm("Delete this unit?") && deleteM.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No units.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
