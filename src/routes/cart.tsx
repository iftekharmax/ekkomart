import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — FreshCart" }] }),
  component: CartPage,
});

function CartPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <ShoppingCart className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold">Your Cart</h1>
      <p className="text-muted-foreground">Your cart is empty. Start shopping to add items.</p>
      <Link to="/shop" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        Browse products
      </Link>
    </div>
  );
}
