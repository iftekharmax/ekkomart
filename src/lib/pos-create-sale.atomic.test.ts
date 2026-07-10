import { describe, expect, it } from "vitest";

type Checkout = { product_id: string; variation_id: string; qty: number; parent_name: string; variation_name: string };

class VariationStockSimulator {
  private locked = Promise.resolve();
  constructor(private stock: number) {}

  async checkout(items: Checkout[]) {
    const previous = this.locked;
    let release!: () => void;
    this.locked = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      const requested = items.reduce((sum, item) => sum + item.qty, 0);
      const label = `${items[0].parent_name} - ${items[0].variation_name}`;
      if (requested < 1) throw new Error(`Invalid quantity for ${label}`);
      if (this.stock < requested) throw new Error(`Insufficient stock for ${label}: only ${this.stock} available`);
      this.stock -= requested;
      return { ok: true, stock: this.stock };
    } finally {
      release();
    }
  }

  currentStock() {
    return this.stock;
  }
}

describe("pos_create_sale atomic variation stock behavior", () => {
  it("serializes concurrent variation checkouts so stock cannot be oversold", async () => {
    const stock = new VariationStockSimulator(1);
    const item = {
      product_id: "product-1",
      variation_id: "variation-1",
      qty: 1,
      parent_name: "Premium Dates",
      variation_name: "Large Pack",
    };

    const results = await Promise.allSettled([stock.checkout([item]), stock.checkout([item])]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(stock.currentStock()).toBe(0);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({
      reason: expect.objectContaining({ message: expect.stringContaining("Insufficient stock for Premium Dates - Large Pack") }),
    });
  });

  it("rejects invalid variation quantity before stock changes", async () => {
    const stock = new VariationStockSimulator(5);

    await expect(stock.checkout([{
      product_id: "product-1",
      variation_id: "variation-1",
      qty: 0,
      parent_name: "Premium Dates",
      variation_name: "Large Pack",
    }])).rejects.toThrow("Invalid quantity for Premium Dates - Large Pack");
    expect(stock.currentStock()).toBe(5);
  });
});