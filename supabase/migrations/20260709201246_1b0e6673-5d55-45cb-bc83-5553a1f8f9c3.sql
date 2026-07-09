
-- Restore column-level SELECT for anon/authenticated, excluding cost_price.
REVOKE SELECT ON public.products FROM anon, authenticated;
REVOKE SELECT ON public.product_variations FROM anon, authenticated;

GRANT SELECT (
  id, name, slug, sku, barcode, unit, price, old_price, tax_percent, stock, low_stock_alert,
  product_type, supplier_id, rating, reviews, tag, img, category, subcategory, brand, in_stock,
  images, video_url, description, specifications, weight_value, weight_unit, tags,
  seo_title, seo_description, seo_keywords, created_at, updated_at
) ON public.products TO anon, authenticated;

GRANT SELECT (
  id, product_id, name, attributes, sku, barcode, price, discount_price, stock, low_stock_alert,
  image_url, is_active, position, created_at, updated_at
) ON public.product_variations TO anon, authenticated;

-- Add public read RLS policies (cost_price is still blocked by the missing column grant).
DROP POLICY IF EXISTS "Public can view products" ON public.products;
CREATE POLICY "Public can view products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can view product variations" ON public.product_variations;
CREATE POLICY "Public can view product variations"
  ON public.product_variations FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
