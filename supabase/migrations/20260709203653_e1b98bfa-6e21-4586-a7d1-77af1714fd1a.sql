
-- Products: revoke broad public SELECT, regrant only non-sensitive columns
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (
  id, name, slug, sku, unit, price, old_price, tax_percent, stock,
  product_type, rating, reviews, tag, img, category, subcategory, brand,
  in_stock, images, video_url, description, specifications,
  weight_value, weight_unit, tags, seo_title, seo_description, seo_keywords,
  created_at, updated_at
) ON public.products TO anon, authenticated;
-- Admin server code uses service_role via supabaseAdmin, which retains full access.
GRANT ALL ON public.products TO service_role;

-- Product variations: revoke broad public SELECT, regrant excluding cost_price and barcode
REVOKE SELECT ON public.product_variations FROM anon, authenticated;
GRANT SELECT (
  id, product_id, name, attributes, sku, price, discount_price,
  stock, image_url, is_active, position, created_at, updated_at
) ON public.product_variations TO anon, authenticated;
GRANT ALL ON public.product_variations TO service_role;

-- Consolidate duplicate storage policies on product-media
DROP POLICY IF EXISTS "product-media admin insert" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin update" ON storage.objects;
DROP POLICY IF EXISTS "product-media admin delete" ON storage.objects;
DROP POLICY IF EXISTS "product-media public read" ON storage.objects;
