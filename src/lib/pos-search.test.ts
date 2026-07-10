import { describe, expect, it } from "vitest";
import { mapPosSearchRows } from "./pos-search";

const product = {
  id: "product-1",
  name: "Premium Dates",
  sku: "DATES-PARENT",
  barcode: "PARENT-000",
  price: 500,
  stock: 10,
  img: "parent.jpg",
  unit: "box",
  product_type: "variable",
  product_variations: [
    {
      id: "variation-small",
      name: "Small Pack",
      sku: "DATES-S",
      barcode: "1111111111111",
      price: 150,
      stock: 7,
      image_url: "small.jpg",
      is_active: true,
      position: 2,
    },
    {
      id: "variation-large",
      name: "Large Pack",
      sku: "DATES-L",
      barcode: "2222222222222",
      price: 280,
      stock: 3,
      image_url: "large.jpg",
      is_active: true,
      position: 1,
    },
  ],
};

describe("POS variation search mapping", () => {
  it("returns variation items as separate rows with parent context", () => {
    const rows = mapPosSearchRows([product], "dates", 10);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(["variation-large", "variation-small"]);
    expect(rows[0]).toMatchObject({
      product_id: "product-1",
      variation_id: "variation-large",
      parent_name: "Premium Dates",
      variation_name: "Large Pack",
      name: "Premium Dates - Large Pack",
      barcode: "2222222222222",
      price: 280,
      stock: 3,
    });
  });

  it("puts the exact typed barcode variation before the parent product", () => {
    const rows = mapPosSearchRows([product], "1111111111111", 10);

    expect(rows[0]).toMatchObject({
      id: "variation-small",
      variation_id: "variation-small",
      parent_name: "Premium Dates",
      variation_name: "Small Pack",
    });
    expect(rows.every((row) => row.variation_id)).toBe(true);
  });
});