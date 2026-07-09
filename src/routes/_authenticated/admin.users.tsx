import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listUsers, assignRole, removeRole } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Shield, ShieldOff, UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsers,
});

type Role = "admin" | "user";

function AdminUsers() {
  const listFn = useServerFn(listUsers);
  const assignFn = useServerFn(assignRole);
  const removeFn = useServerFn(removeRole);
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const assignMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => assignFn({ data: v }),
    onSuccess: () => {
      toast.success("Role assigned");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => removeFn({ data: v }),
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = assignMut.isPending || removeMut.isPending;

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        <UserCog className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Users & Roles</h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users as any[]).map((u) => {
                const isAdmin = u.roles.includes("admin");
                return (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{u.profile?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {u.roles.map((r: string) => (
                        <span
                          key={r}
                          className={`mr-1 rounded-full px-2 py-0.5 text-xs ${
                            r === "admin" ? "bg-primary/10 text-primary" : "bg-muted"
                          }`}
                        >
                          {r}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => removeMut.mutate({ userId: u.id, role: "admin" })}
                          >
                            <ShieldOff className="mr-1 h-3.5 w-3.5" />
                            Revoke admin
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => assignMut.mutate({ userId: u.id, role: "admin" })}
                          >
                            <Shield className="mr-1 h-3.5 w-3.5" />
                            Make admin
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
