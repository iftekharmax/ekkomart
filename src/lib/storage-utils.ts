import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-media";

/** Extract the object path inside `product-media` from a public or signed URL. */
export function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const m = u.pathname.match(new RegExp(`/object/(?:public|sign)/${BUCKET}/(.+)$`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

/** Best-effort delete of a stored object referenced by a signed/public URL. */
export async function removeStoredImage(url: string | null | undefined): Promise<void> {
  const path = extractStoragePath(url);
  if (!path) return;
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* ignore — cleanup is best-effort */
  }
}
