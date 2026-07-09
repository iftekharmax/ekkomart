## Product Module Expansion

Extend the `products` table and admin form with all requested fields. Media stored in a Lovable Cloud bucket; barcode scanner supports both camera and hardware input.

### 1. Database migration (single migration)

Add columns to `public.products`:

- `slug` text UNIQUE NOT NULL (auto from name, editable)
- `sku` text UNIQUE NOT NULL (auto-generated: `SKU-XXXXXX`)
- `barcode` text UNIQUE (auto EAN-13 if left blank; manual override allowed)
- `subcategory` text
- `images` text[] DEFAULT '{}' (kept legacy `img` in sync with `images[0]`)
- `video_url` text
- `description` text
- `specifications` jsonb DEFAULT '{}' (key/value pairs)
- `weight_value` numeric, `weight_unit` text (g/kg/lb)
- `tags` text[] DEFAULT '{}'
- `seo_title` text, `seo_description` text, `seo_keywords` text[]

Trigger `set_updated_at` already exists — keep. Add BEFORE-INSERT trigger to backfill `slug` and `sku` when missing.

Backfill existing rows with generated slug/sku so the NOT NULL/UNIQUE succeeds.

### 2. Storage

- Create private bucket `product-media` via storage tool
- RLS on `storage.objects`: public SELECT for that bucket; INSERT/UPDATE/DELETE only for `has_role(auth.uid(),'admin')`
- Admin form uploads to `product-media/{productId or draft}/...` and stores public URLs in `images[]` / `video_url`

### 3. Server functions (`src/lib/products.functions.ts`)

- Extend Zod validators with all new fields
- `createProduct` / `updateProduct` handle new fields; slug uniqueness enforced by DB
- Add `generateBarcode` helper (EAN-13 with check digit)

### 4. Admin form (`src/routes/_authenticated/admin.products.tsx`)

Rebuild as a tabbed dialog:

- **Basics**: name → auto-slug (editable), unit, price, old_price, category, subcategory, brand, tag, in_stock
- **Identifiers**: SKU (auto, editable), barcode (auto, manual input, "Scan" button that opens camera scanner via `@zxing/browser`, and a focused input for USB/BT scanners)
- **Media**: multi-image drag-drop uploader (thumbs, reorder, delete), single video upload
- **Content**: description (textarea), specifications (key/value repeater)
- **Logistics**: weight value + unit, tags (chip input)
- **SEO**: seo_title, seo_description, seo_keywords

### 5. Packages

`bun add @zxing/browser slugify`

### 6. Storefront

Non-goal in this pass beyond making sure `img` still resolves (kept in sync with `images[0]`). Product detail page can be enhanced next.

### Technical notes

- Slug generation: `slugify(name, {lower:true, strict:true})` + short random suffix on collision
- SKU: `SKU-` + 8 hex chars from `gen_random_bytes`
- Barcode: 12 random digits + EAN-13 check digit
- Scanner: `BrowserMultiFormatReader` from `@zxing/browser`, released on unmount
- Media bucket is public-read so storefront `<img>`/`<video>` work without signed URLs
