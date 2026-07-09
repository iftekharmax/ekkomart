import { createClient } from "@supabase/supabase-js";

// Publishable (anon) values are safe to ship in client code.
const SUPABASE_URL = "https://ahfaigussxojbrcedgzt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_i_iJ6M36V5FemGYXdxAfWg_nF0nQQcv";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
