-- Restrict access to internal/cost columns on public.products for anon and authenticated roles.
-- Admin server code uses the service_role client which bypasses column grants.
REVOKE SELECT ON public.products FROM anon;
REVOKE SELECT ON public.products FROM authenticated;

GRANT SELECT (
  id, name, slug, unit, price, old_price, tax_percent, stock, in_stock,
  product_type, tag, img, images, video_url, description, specifications,
  weight_value, weight_unit, tags, category, subcategory, brand,
  seo_title, seo_description, seo_keywords, low_stock_alert,
  sku, barcode, created_at, updated_at
) ON public.products TO anon, authenticated;

-- cost_price and supplier_id remain readable only via service_role (already has GRANT ALL).
