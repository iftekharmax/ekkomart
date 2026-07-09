import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — FreshCart" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <Heart className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold">Your Wishlist</h1>
      <p className="text-muted-foreground">Save items you love to find them here later.</p>
      <Link to="/shop" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        Discover products
      </Link>
    </div>
  );
}
