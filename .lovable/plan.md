## Purchase Module

Add supplier purchases that automatically bump stock for simple products and per-variation for variable products.

### 1. Database migration

New tables in `public`:

- `purchases`
  - `id uuid pk`, `supplier_id uuid fk suppliers`, `purchase_date date default now()`
  - `reference text` (auto `PUR-YYMMDD-XXXX`), `note text`
  - `subtotal numeric`, `discount numeric default 0`, `tax numeric default 0`, `shipping numeric default 0`, `total numeric`
  - `paid numeric default 0`, `status text default 'received'` (received | pending)
  - `created_by uuid`, `created_at`, `updated_at`

- `purchase_items`
  - `id uuid pk`, `purchase_id uuid fk purchases on delete cascade`
  - `product_id uuid fk products`, `variation_id uuid fk product_variations null`
  - `quantity numeric not null check (>0)`, `unit_cost numeric not null default 0`, `line_total numeric`

Grants: `authenticated` full, `service_role` all. RLS: admin-only via `has_role`.

Trigger `apply_purchase_stock` AFTER INSERT on `purchase_items`:
- If `variation_id` present → `UPDATE product_variations SET stock = stock + NEW.quantity`
- Else → `UPDATE products SET stock = coalesce(stock,0) + NEW.quantity`

Symmetric reverse on DELETE (so deleting a purchase rolls stock back via cascade).

### 2. Server functions (`src/lib/purchases.functions.ts`)

- `listPurchases()` — join supplier name, item count, total
- `getPurchase({id})` — header + items with product/variation names
- `createPurchase({supplier_id, note, discount, tax, shipping, paid, items:[{product_id, variation_id?, quantity, unit_cost}]})` — inserts header + items in one call; stock updates happen via trigger
- `deletePurchase({id})` — cascade rolls stock back

All admin-guarded via `requireSupabaseAuth` + `has_role('admin')`.

### 3. Admin UI

- Route `src/routes/_authenticated/admin.purchases.index.tsx` — list table (date, ref, supplier, items, total, actions)
- Route `src/routes/_authenticated/admin.purchases.new.tsx` — form:
  - Supplier select
  - Item rows: product combobox → if variable, show variation select; qty; unit cost; line total
  - Discount / tax / shipping / paid; live grand total
- Route `src/routes/_authenticated/admin.purchases.$id.tsx` — read-only detail with delete button
- Add "Purchases" link in admin sidebar (`admin.tsx`)

### 4. Technical notes

- Reference format generated in server fn (`PUR-YYMMDD-` + 4 random hex).
- Trigger keeps stock authoritative — client never sends stock deltas.
- `products.stock` may be null for legacy rows; trigger uses `coalesce`.
- Deleting a purchase decrements stock; UI confirms before delete.
- Variation dropdown filtered client-side using existing `listVariations` fn.
