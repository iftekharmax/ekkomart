import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyRole } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { User, Package, MapPin, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Account — Tokyohalal" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setName(
        (data.user?.user_metadata as { full_name?: string } | undefined)?.full_name ??
          data.user?.email?.split("@")[0] ?? null,
      );
    });
  }, []);

  const roleFn = useServerFn(getMyRole);
  const { data: roles = [] } = useQuery({ queryKey: ["my-role"], queryFn: () => roleFn() });
  const isAdmin = roles.includes("admin");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-4 rounded-2xl border bg-card p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <User className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">{name ?? "My account"}</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
        {isAdmin && (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Admin</span>
        )}
      </div>

      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        <li>
          <Link to="/orders" className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent">
            <Package className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">My Orders</span>
          </Link>
        </li>
        <li>
          <Link to="/addresses" className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">Addresses</span>
          </Link>
        </li>
        {isAdmin && (
          <li>
            <Link to="/admin" className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">Admin Panel</span>
            </Link>
          </li>
        )}
      </ul>

      <Button variant="outline" className="mt-6 w-full" onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" /> Log out
      </Button>
    </div>
  );
}
