// Admin layout — gates all /admin routes by role.
import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Package, ShoppingBag, Users, ArrowLeft, Carrot, LogOut, ChevronDown, PlusCircle, FolderTree, ListTree, Ruler, Tags, BadgeCheck, Truck, ShoppingCart, SlidersHorizontal, Undo2, Calculator, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Tokyohalal" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/profile" });
  },
  component: AdminLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: any;
  exact?: boolean;
  children?: { to: string; label: string; icon: any }[];
};

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/pos", label: "POS", icon: Calculator },
  { to: "/admin/sales", label: "Sales", icon: Receipt },
  {
    to: "/admin/products",
    label: "Products",
    icon: Package,
    children: [
      { to: "/admin/products", label: "All Products", icon: PlusCircle },
      { to: "/admin/categories", label: "Category", icon: FolderTree },
      { to: "/admin/subcategories", label: "Sub Category", icon: ListTree },
      { to: "/admin/brands", label: "Brands", icon: BadgeCheck },
      { to: "/admin/units", label: "Units", icon: Ruler },
      { to: "/admin/attributes", label: "Attributes", icon: Tags },
      { to: "/admin/suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  { to: "/admin/purchases", label: "Purchases", icon: ShoppingCart },
  {
    to: "/admin/purchase-returns",
    label: "Returns",
    icon: Undo2,
    children: [
      { to: "/admin/purchase-returns", label: "Purchase Return", icon: Undo2 },
      { to: "/admin/sales-returns", label: "Sales Return", icon: Undo2 },
    ],
  },
  { to: "/admin/stock-adjustments", label: "Stock Adjustments", icon: SlidersHorizontal },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/users", label: "Users", icon: Users },
];

function isActivePath(path: string, item: { to: string; exact?: boolean }) {
  return item.exact ? path === item.to : path === item.to || path.startsWith(item.to + "/");
}

function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const onSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
  };

  const activeLabel =
    NAV.flatMap((n) => (n.children ? [n, ...n.children.map((c) => ({ ...c, exact: true }))] : [n]))
      .find((n) => isActivePath(path, n as any))?.label ?? "Admin";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-6 dark:border-slate-800">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Carrot className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">Tokyohalal</div>
            <div className="truncate text-[10px] uppercase tracking-wider text-slate-500">Admin Console</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Management
          </div>
          {NAV.map((n) => (
            <NavRow key={n.to} item={n} path={path} />
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <Link
            to="/"
            className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to store
          </Link>
          <button
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar + horizontal nav */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Carrot className="h-4 w-4" />
              </span>
              <span className="font-bold">Admin</span>
            </div>
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
              Exit
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2">
            {NAV.flatMap((n) => (n.children ? n.children : [n])).map((n) => {
              const active = isActivePath(path, { to: n.to, exact: true });
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-primary text-primary-foreground" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <n.icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
        </header>
      </div>

      {/* Content */}
      <div className="lg:pl-64">
        <header className="hidden h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-8 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:flex">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Admin</div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeLabel}</h1>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavRow({ item, path }: { item: NavItem; path: string }) {
  const active = isActivePath(path, item);
  const hasChildren = !!item.children?.length;
  const childActive = hasChildren && item.children!.some((c) => isActivePath(path, { to: c.to, exact: true }));
  const [open, setOpen] = useState(active || childActive);
  const submenuId = `submenu-${item.to.replace(/\W+/g, "-")}`;

  // Keep submenu open when a child becomes active (e.g. after navigation).
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (!hasChildren) {
    return (
      <Link
        to={item.to}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/60 ${
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <item.icon className={`h-4 w-4 ${active ? "" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"}`} />
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={submenuId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setOpen(true); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); setOpen(false); }
          else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); }
        }}
        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-primary/60 ${
          childActive
            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        }`}
      >
        <item.icon className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        id={submenuId}
        role="region"
        hidden={!open}
        className="mt-1 space-y-1 pl-4"
      >
        {item.children!.map((c) => {
          const a = isActivePath(path, { to: c.to, exact: true });
          return (
            <Link
              key={c.to}
              to={c.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-primary/60 ${
                a
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
              aria-current={a ? "page" : undefined}
            >
              <c.icon className={`h-4 w-4 ${a ? "" : "text-slate-400"}`} />
              {c.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
