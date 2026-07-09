import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listUsers, assignRole, removeRole, createUser, updateUser, deleteUser,
} from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, ShieldOff, UserCog, UserPlus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: AdminUsers });

type Role = "admin" | "user";
type Row = {
  id: string; email: string; created_at: string;
  profile: { full_name?: string | null } | null;
  roles: string[];
};

function AdminUsers() {
  const listFn = useServerFn(listUsers);
  const assignFn = useServerFn(assignRole);
  const removeFn = useServerFn(removeRole);
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);
  const deleteFn = useServerFn(deleteUser);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"], queryFn: () => listFn(),
  });

  const assignMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => assignFn({ data: v }),
    onSuccess: () => { toast.success("Role assigned"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => removeFn({ data: v }),
    onSuccess: () => { toast.success("Role removed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => { toast.success("User deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = assignMut.isPending || removeMut.isPending || delMut.isPending;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Users & Roles</h2>
        </div>
        <CreateUserDialog onCreate={(v) => createFn({ data: v }).then(() => { toast.success("User created"); invalidate(); }).catch((e: Error) => toast.error(e.message))} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
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
              {(users as Row[]).map((u) => {
                const isAdmin = u.roles.includes("admin");
                return (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{u.profile?.full_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.roles.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      {u.roles.map((r) => (
                        <span key={r} className={`mr-1 rounded-full px-2 py-0.5 text-xs ${r === "admin" ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                          {r}
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {isAdmin ? (
                          <Button size="sm" variant="outline" disabled={busy}
                            onClick={() => removeMut.mutate({ userId: u.id, role: "admin" })}>
                            <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revoke admin
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busy}
                            onClick={() => assignMut.mutate({ userId: u.id, role: "admin" })}>
                            <Shield className="mr-1 h-3.5 w-3.5" /> Make admin
                          </Button>
                        )}
                        <EditUserDialog user={u} onSave={(v) => updateFn({ data: { userId: u.id, ...v } }).then(() => { toast.success("User updated"); invalidate(); }).catch((e: Error) => toast.error(e.message))} />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={busy}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes {u.email}. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => delMut.mutate(u.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

function CreateUserDialog({ onCreate }: { onCreate: (v: { email: string; password: string; full_name: string; role: Role }) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [full_name, setName] = useState("");
  const [role, setRole] = useState<Role>("user");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus className="mr-2 h-4 w-4" /> Add user</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!email || password.length < 6}
            onClick={() => { onCreate({ email, password, full_name, role }); setOpen(false); setEmail(""); setPassword(""); setName(""); setRole("user"); }}
          >Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onSave }: { user: Row; onSave: (v: { email?: string; full_name?: string; password?: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [full_name, setName] = useState(user.profile?.full_name ?? "");
  const [password, setPassword] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit user</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full name</Label><Input value={full_name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>New password (optional)</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSave({ email, full_name, password: password || undefined }); setOpen(false); setPassword(""); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
