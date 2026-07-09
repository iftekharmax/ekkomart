// Upload/delete images against a cPanel-hosted PHP endpoint (see cpanel-upload.php).
// Configure via .env:
//   VITE_UPLOAD_BASE_URL=https://yourdomain.com/api   (path where upload.php lives)
//   VITE_UPLOAD_TOKEN=<same secret as in upload.php>

const BASE = (import.meta.env.VITE_UPLOAD_BASE_URL as string | undefined)?.replace(/\/$/, "");
const TOKEN = import.meta.env.VITE_UPLOAD_TOKEN as string | undefined;

function endpoint(): string {
  if (!BASE || !TOKEN) {
    throw new Error(
      "Image upload not configured. Set VITE_UPLOAD_BASE_URL and VITE_UPLOAD_TOKEN in .env.",
    );
  }
  return `${BASE}/upload.php`;
}

export async function uploadImage(file: File, folder: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: { "X-Auth": TOKEN! },
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed [${res.status}]: ${text || res.statusText}`);
  }
  const json = (await res.json()) as { url?: string; error?: string };
  if (!json.url) throw new Error(json.error || "Upload failed");
  return json.url;
}

export async function removeStoredImage(url: string | null | undefined): Promise<void> {
  if (!url || !BASE || !TOKEN) return;
  try {
    await fetch(endpoint(), {
      method: "DELETE",
      headers: { "X-Auth": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    /* best-effort */
  }
}
