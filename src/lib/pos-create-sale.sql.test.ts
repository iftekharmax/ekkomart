import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260710230421_d11ef1ad-7521-47e6-817d-de3c2201b25b.sql"),
  "utf8",
);

describe("pos_create_sale RPC migration", () => {
  it("uses row locks, aggregate quantity validation, and variation stock decrement", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.pos_create_sale");
    expect(migrationSql).toContain("SECURITY INVOKER");
    expect(migrationSql).toContain("SUM((value->>'qty')::int)::int AS requested_qty");
    expect(migrationSql).toContain("WHERE id = req.stock_id FOR UPDATE");
    expect(migrationSql).toContain("IF qty < 1 THEN RAISE EXCEPTION 'Invalid quantity for %'");
    expect(migrationSql).toContain("UPDATE public.product_variations SET stock = stock - qty WHERE id = vid");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.pos_create_sale(jsonb, numeric, numeric, numeric, text, text) FROM PUBLIC, anon");
  });
});