export type PosProductResult = {
  id: string;
  product_id: string;
  variation_id: string | null;
  parent_name: string | null;
  variation_name: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  stock: number | null;
  img: string | null;
  unit: string | null;
};

type VariationRow = {
  id: string;
  name: string | null;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  stock: number | null;
  image_url: string | null;
  is_active: boolean | null;
  position: number | null;
};

type ProductRow = {
  id: string;
  name: string | null;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  stock: number | null;
  img: string | null;
  unit: string | null;
  product_type: string | null;
  product_variations?: VariationRow[] | null;
};

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
const includes = (value: unknown, q: string) => norm(value).includes(q);
const exact = (value: unknown, q: string) => q.length > 0 && norm(value) === q;

function variationScore(product: ProductRow, variation: VariationRow, q: string, parentMatches: boolean) {
  if (!q) return 100 + (variation.position ?? 0);
  if (exact(variation.barcode, q)) return 0;
  if (exact(variation.sku, q)) return 1;
  if (exact(variation.name, q)) return 2;
  if (includes(variation.barcode, q)) return 4;
  if (includes(variation.sku, q)) return 5;
  if (includes(variation.name, q)) return 6;
  if (exact(product.barcode, q)) return 20 + (variation.position ?? 0);
  if (exact(product.sku, q)) return 21 + (variation.position ?? 0);
  if (exact(product.name, q)) return 22 + (variation.position ?? 0);
  if (parentMatches) return 30 + (variation.position ?? 0);
  return 200 + (variation.position ?? 0);
}

function productScore(product: ProductRow, q: string) {
  if (!q) return 100;
  if (exact(product.barcode, q)) return 10;
  if (exact(product.sku, q)) return 11;
  if (exact(product.name, q)) return 12;
  if (includes(product.barcode, q)) return 40;
  if (includes(product.sku, q)) return 41;
  if (includes(product.name, q)) return 42;
  return 300;
}

export function mapPosSearchRows(rows: ProductRow[], rawQuery: string, limit: number): PosProductResult[] {
  const q = norm(rawQuery);
  const out: Array<PosProductResult & { _score: number; _position: number }> = [];

  for (const product of rows) {
    const productName = String(product.name ?? "").trim();
    const variations = ((product.product_variations ?? []) as VariationRow[])
      .filter((variation) => variation.is_active !== false)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const isVariable = product.product_type === "variable" || variations.length > 0;
    const parentMatches = !q || [product.name, product.sku, product.barcode].some((field) => includes(field, q));

    if (isVariable) {
      for (const variation of variations) {
        const variationMatches = !q || [variation.name, variation.sku, variation.barcode].some((field) => includes(field, q));
        if (!parentMatches && !variationMatches) continue;
        const variationName = String(variation.name ?? "").trim();
        out.push({
          id: variation.id,
          product_id: product.id,
          variation_id: variation.id,
          parent_name: productName,
          variation_name: variationName,
          name: variationName ? `${productName} - ${variationName}` : productName,
          sku: variation.sku ?? null,
          barcode: variation.barcode ?? null,
          price: Number(variation.price ?? product.price) || 0,
          stock: variation.stock ?? null,
          img: variation.image_url ?? product.img ?? null,
          unit: product.unit ?? null,
          _score: variationScore(product, variation, q, parentMatches),
          _position: variation.position ?? 0,
        });
      }
      continue;
    }

    if (!parentMatches) continue;
    out.push({
      id: product.id,
      product_id: product.id,
      variation_id: null,
      parent_name: productName,
      variation_name: null,
      name: productName,
      sku: product.sku ?? null,
      barcode: product.barcode ?? null,
      price: Number(product.price) || 0,
      stock: product.stock ?? null,
      img: product.img ?? null,
      unit: product.unit ?? null,
      _score: productScore(product, q),
      _position: 0,
    });
  }

  return out
    .sort((a, b) => a._score - b._score || (a.parent_name ?? "").localeCompare(b.parent_name ?? "") || a._position - b._position)
    .slice(0, limit)
    .map(({ _score, _position, ...row }) => row);
}