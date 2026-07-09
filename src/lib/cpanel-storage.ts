// Upload/delete images against the Supabase Storage `product-media` bucket.
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-media";

function randName(ext: string) {
  const rand = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(rand).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex}.${ext}`;
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder || "misc"}/${randName(ext || "bin")}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeStoredImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length);
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* best-effort */
  }
}
