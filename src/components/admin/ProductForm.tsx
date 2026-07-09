import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCategories, listSubcategories } from "@/lib/taxonomy.functions";
import { listBrands, listUnits, listAttributes } from "@/lib/catalog.functions";
import { uploadImage } from "@/lib/cpanel-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { Badge } from "@/components/ui/badge";
import { Plus, X, Upload, ScanLine, Camera, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BrowserMultiFormatReader } from "@zxing/browser";
import slugify from "slugify";

export type Spec = { key: string; value: string };
export type Variation = {
  id?: string;
  name: string;
  attributes: Record<string, string>;
  sku: string;
  barcode: string;
  cost_price: number | null;
  price: number;
  discount_price: number | null;
  stock: number;
  low_stock_alert: number | null;
  image_url: string;
  is_active: boolean;
};

export type ProductFormValues = {
  id?: string;
  product_type: "simple" | "variable";
  name: string; slug: string; sku: string; barcode: string;
  unit: string; price: number; old_price: number | null;
  cost_price: number | null; tax_percent: number | null;
  stock: number | null; low_stock_alert: number | null;
  category: string; subcategory: string; brand: string; supplier_id: string; tag: string;
  in_stock: boolean;
  images: string[]; video_url: string;
  description: string; specifications: Spec[];
  weight_value: number | null; weight_unit: string;
  tags: string[];
  seo_title: string; seo_description: string; seo_keywords: string[];
  selected_attributes: { attribute_id: string; name: string; values: string[] }[];
  variations: Variation[];
};

export const emptyProduct: ProductFormValues = {
  product_type: "simple",
  name: "", slug: "", sku: "", barcode: "",
  unit: "1 pc", price: 0, old_price: null,
  cost_price: null, tax_percent: null, stock: 0, low_stock_alert: null,
  category: "", subcategory: "", brand: "", supplier_id: "", tag: "",
  in_stock: true, images: [], video_url: "",
  description: "", specifications: [],
  weight_value: null, weight_unit: "g",
  tags: [], seo_title: "", seo_description: "", seo_keywords: [],
  selected_attributes: [], variations: [],
};

function randHex(n: number) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, n).toUpperCase();
}
export function ean13() {
  let base = "";
  for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10);
  let sum = 0;
  for (let i = 0; i < 12; i++) { const d = Number(base[i]); sum += i % 2 === 0 ? d : d * 3; }
  return base + ((10 - (sum % 10)) % 10);
}
async function uploadFile(file: File, folder: string): Promise<string> {
  return uploadImage(file, folder);
}

export function youtubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
  } catch { /* invalid URL */ }
  return null;
}

export function toProductPayload(f: ProductFormValues) {
  return {
    product_type: f.product_type,
    name: f.name,
    slug: f.slug || slugify(f.name, { lower: true, strict: true }),
    sku: f.sku || `SKU-${randHex(8)}`,
    barcode: f.barcode || ean13(),
    unit: f.unit, price: f.price, old_price: f.old_price,
    cost_price: f.cost_price, tax_percent: null,
    stock: f.id ? f.stock : 0, low_stock_alert: null,
    category: f.category, subcategory: f.subcategory,
    brand: f.brand, supplier_id: null, tag: f.tag,
    in_stock: f.product_type === "variable" ? true : Number(f.stock ?? 0) > 0,
    images: f.images, video_url: f.video_url,
    description: f.description,
    specifications: Object.fromEntries(f.specifications.filter((s) => s.key).map((s) => [s.key, s.value])),
    weight_value: f.weight_value, weight_unit: f.weight_unit,
    tags: f.tags, seo_title: f.seo_title, seo_description: f.seo_description, seo_keywords: f.seo_keywords,
    img: f.images[0] ?? null,
    variations: f.product_type === "variable" ? f.variations.map((v) => ({
      id: v.id, name: v.name, attributes: v.attributes,
      sku: v.sku || `SKU-${randHex(8)}`, barcode: v.barcode || ean13(),
      cost_price: v.cost_price, price: v.price, discount_price: v.discount_price,
      stock: v.stock, low_stock_alert: null,
      image_url: v.image_url || null, is_active: v.is_active,
    })) : [],
  };
}


export function ProductForm({ initial, submitLabel, submitting, onSubmit }: {
  initial: ProductFormValues; submitLabel: string; submitting?: boolean;
  onSubmit: (v: ProductFormValues) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProductFormValues>(initial);
  const catsFn = useServerFn(listCategories);
  const subsFn = useServerFn(listSubcategories);
  const brandsFn = useServerFn(listBrands);
  const unitsFn = useServerFn(listUnits);
  const attrsFn = useServerFn(listAttributes);
  const { data: categories = [] } = useQuery({ queryKey: ["admin-categories"], queryFn: () => catsFn() });
  const { data: subcategories = [] } = useQuery({ queryKey: ["admin-subcategories-all"], queryFn: () => subsFn({ data: {} } as any) });
  const { data: brands = [] } = useQuery({ queryKey: ["admin-brands"], queryFn: () => brandsFn() });
  const { data: units = [] } = useQuery({ queryKey: ["admin-units"], queryFn: () => unitsFn() });

  const { data: attributes = [] } = useQuery({ queryKey: ["admin-attributes"], queryFn: () => attrsFn() });

  const selectedCat = (categories as any[]).find((c) => c.name === form.category || c.slug === form.category);
  const filteredSubs = (subcategories as any[]).filter((s) => !selectedCat || s.category_id === selectedCat.id);

  const submit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(form); };

  const isVar = form.product_type === "variable";

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-6">
      <div className="mb-6 flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <Label className="font-semibold">Product type:</Label>
        <div className="flex gap-2">
          {(["simple", "variable"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setForm({ ...form, product_type: t })}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                form.product_type === t ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="mb-3 text-lg font-semibold">Basics</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Product name</Label>
              <Input required value={form.name} onChange={(e) => {
                const name = e.target.value;
                setForm({ ...form, name, slug: form.slug || slugify(name, { lower: true, strict: true }) });
              }} />
            </div>
            <div className="sm:col-span-2"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto from name" /></div>
            <div>
              <Label>Category</Label>
              <select required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: "" })}>
                <option value="">Select category…</option>
                {(categories as any[]).map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Subcategory</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })} disabled={!selectedCat}>
                <option value="">{selectedCat ? "Select…" : "Pick a category first"}</option>
                {filteredSubs.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Brand</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                <option value="">—</option>
                {(brands as any[]).map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Unit</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {(units as any[]).map((u) => <option key={u.id} value={u.name}>{u.name}{u.symbol ? ` (${u.symbol})` : ""}</option>)}
                {(units as any[]).length === 0 && <option value={form.unit}>{form.unit}</option>}
              </select>
            </div>
            <div><Label>Tag</Label><Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="e.g. New, Popular" /></div>

            {!isVar && (
              <>
                <div><Label>Purchase price</Label><Input type="number" step="0.01" value={form.cost_price ?? ""} onChange={(e) => setForm({ ...form, cost_price: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label>Selling price</Label><Input required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
                <div><Label>Old price</Label><Input type="number" step="0.01" value={form.old_price ?? ""} onChange={(e) => setForm({ ...form, old_price: e.target.value ? Number(e.target.value) : null })} /></div>
                <div>
                  <Label>Barcode (EAN-13)</Label>
                  <div className="flex gap-2">
                    <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Scan or auto-generate" />
                    <Button type="button" variant="outline" onClick={() => setForm({ ...form, barcode: ean13() })}><RefreshCw className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <BarcodeScanner onScan={(code) => setForm({ ...form, barcode: code })} />
                </div>
              </>
            )}
          </div>
        </section>


        {isVar && (
          <section>
            <h3 className="mb-3 text-lg font-semibold">Variations</h3>
            <VariationsBuilder attributes={attributes as any[]} form={form} setForm={setForm} />
          </section>
        )}

        <section>
          <h3 className="mb-3 text-lg font-semibold">Product images</h3>
          <ImageUploader images={form.images} onChange={(images) => setForm({ ...form, images })} />
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Product video (YouTube)</h3>
          <Input
            value={form.video_url}
            placeholder="https://www.youtube.com/watch?v=..."
            onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          />
          {form.video_url && youtubeEmbedUrl(form.video_url) && (
            <div className="mt-3 aspect-video max-w-md overflow-hidden rounded-md border">
              <iframe
                className="h-full w-full"
                src={youtubeEmbedUrl(form.video_url)!}
                title="YouTube preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Description</h3>
          <Textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Specifications</h3>
          <div className="space-y-2">
            {form.specifications.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Key" value={s.key} onChange={(e) => { const specs = [...form.specifications]; specs[i] = { ...specs[i], key: e.target.value }; setForm({ ...form, specifications: specs }); }} />
                <Input placeholder="Value" value={s.value} onChange={(e) => { const specs = [...form.specifications]; specs[i] = { ...specs[i], value: e.target.value }; setForm({ ...form, specifications: specs }); }} />
                <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, specifications: form.specifications.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => setForm({ ...form, specifications: [...form.specifications, { key: "", value: "" }] })}><Plus className="mr-1 h-4 w-4" /> Add spec</Button>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Tags</h3>
          <ChipInput values={form.tags} onChange={(tags) => setForm({ ...form, tags })} placeholder="Type a tag and press Enter" />
        </section>


        <section>
          <h3 className="mb-3 text-lg font-semibold">SEO</h3>
          <div className="space-y-3">
            <div><Label>SEO title</Label><Input value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} /></div>
            <div><Label>SEO description</Label><Textarea rows={3} value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} /></div>
            <div><Label>SEO keywords</Label><ChipInput values={form.seo_keywords} onChange={(seo_keywords) => setForm({ ...form, seo_keywords })} placeholder="Add keyword and press Enter" /></div>
          </div>
        </section>
      </div>

      <div className="mt-6 flex gap-2">
        <Button type="submit" disabled={submitting}>{submitLabel}</Button>
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/products" })}>Cancel</Button>
      </div>
    </form>
  );
}

/* -------- Variations builder -------- */

function VariationsBuilder({ attributes, form, setForm }: {
  attributes: any[]; form: ProductFormValues; setForm: (v: ProductFormValues) => void;
}) {
  const toggleAttr = (a: any) => {
    const exists = form.selected_attributes.find((x) => x.attribute_id === a.id);
    const next = exists
      ? form.selected_attributes.filter((x) => x.attribute_id !== a.id)
      : [...form.selected_attributes, { attribute_id: a.id, name: a.name, values: [] as string[] }];
    setForm({ ...form, selected_attributes: next });
  };
  const toggleValue = (attrId: string, val: string) => {
    const next = form.selected_attributes.map((a) => a.attribute_id === attrId
      ? { ...a, values: a.values.includes(val) ? a.values.filter((v) => v !== val) : [...a.values, val] }
      : a);
    setForm({ ...form, selected_attributes: next });
  };
  const generate = () => {
    const chosen = form.selected_attributes.filter((a) => a.values.length > 0);
    if (chosen.length === 0) { toast.error("Pick attribute values first"); return; }
    // cartesian product
    let combos: Record<string, string>[] = [{}];
    for (const a of chosen) {
      const next: Record<string, string>[] = [];
      for (const c of combos) for (const v of a.values) next.push({ ...c, [a.name]: v });
      combos = next;
    }
    const existing = new Map(form.variations.map((v) => [Object.entries(v.attributes).map(([k, x]) => `${k}=${x}`).sort().join("|"), v]));
    const rows: Variation[] = combos.map((attrs) => {
      const key = Object.entries(attrs).map(([k, x]) => `${k}=${x}`).sort().join("|");
      const prior = existing.get(key);
      if (prior) return prior;
      return {
        name: Object.values(attrs).join(" / "),
        attributes: attrs, sku: `SKU-${randHex(8)}`, barcode: ean13(),
        cost_price: null, price: form.price || 0, discount_price: null,
        stock: 0, low_stock_alert: null, image_url: "", is_active: true,
      };
    });
    setForm({ ...form, variations: rows });
  };
  const update = (i: number, patch: Partial<Variation>) => {
    const next = [...form.variations]; next[i] = { ...next[i], ...patch };
    setForm({ ...form, variations: next });
  };
  const remove = (i: number) => setForm({ ...form, variations: form.variations.filter((_, j) => j !== i) });

  return (
    <div className="space-y-4">
      <div>
        <Label>Attributes</Label>
        <div className="mt-1 flex flex-wrap gap-2">
          {(attributes as any[]).map((a) => {
            const active = !!form.selected_attributes.find((x) => x.attribute_id === a.id);
            return (
              <button key={a.id} type="button" onClick={() => toggleAttr(a)}
                className={`rounded-full border px-3 py-1 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
                {a.name}
              </button>
            );
          })}
          {attributes.length === 0 && <p className="text-xs text-muted-foreground">No attributes yet — create them in Attributes admin.</p>}
        </div>
      </div>

      {form.selected_attributes.map((sel) => {
        const attr = (attributes as any[]).find((a) => a.id === sel.attribute_id);
        const values: string[] = attr?.values ?? [];
        return (
          <div key={sel.attribute_id} className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">{sel.name} values</div>
            <div className="flex flex-wrap gap-1">
              {values.map((v) => {
                const on = sel.values.includes(v);
                return (
                  <button key={v} type="button" onClick={() => toggleValue(sel.attribute_id, v)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{v}</button>
                );
              })}
              {values.length === 0 && <span className="text-xs text-muted-foreground">This attribute has no values.</span>}
            </div>
          </div>
        );
      })}

      <Button type="button" onClick={generate}>Generate variations</Button>

      {form.variations.length > 0 && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-2">Image</th>
                <th className="p-2">Name</th>
                <th className="p-2">SKU</th>
                <th className="p-2">Barcode</th>
                <th className="p-2">Cost</th>
                <th className="p-2">Price</th>
                <th className="p-2">Discount</th>
                <th className="p-2">Stock</th>
                <th className="p-2">Low alert</th>
                <th className="p-2">Active</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {form.variations.map((v, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2"><VariationImage value={v.image_url} onChange={(url) => update(i, { image_url: url })} /></td>
                  <td className="p-2 min-w-[140px]"><Input value={v.name} onChange={(e) => update(i, { name: e.target.value })} /></td>
                  <td className="p-2 min-w-[140px]"><div className="flex gap-1"><Input value={v.sku} onChange={(e) => update(i, { sku: e.target.value })} /><Button type="button" size="icon" variant="outline" onClick={() => update(i, { sku: `SKU-${randHex(8)}` })}><RefreshCw className="h-3 w-3" /></Button></div></td>
                  <td className="p-2 min-w-[150px]"><div className="flex gap-1"><Input value={v.barcode} onChange={(e) => update(i, { barcode: e.target.value })} /><Button type="button" size="icon" variant="outline" onClick={() => update(i, { barcode: ean13() })}><RefreshCw className="h-3 w-3" /></Button></div></td>
                  <td className="p-2"><Input type="number" step="0.01" className="w-24" value={v.cost_price ?? ""} onChange={(e) => update(i, { cost_price: e.target.value ? Number(e.target.value) : null })} /></td>
                  <td className="p-2"><Input type="number" step="0.01" className="w-24" value={v.price} onChange={(e) => update(i, { price: Number(e.target.value) })} /></td>
                  <td className="p-2"><Input type="number" step="0.01" className="w-24" value={v.discount_price ?? ""} onChange={(e) => update(i, { discount_price: e.target.value ? Number(e.target.value) : null })} /></td>
                  <td className="p-2"><Input type="number" className="w-20" value={v.stock} onChange={(e) => update(i, { stock: Number(e.target.value) })} /></td>
                  <td className="p-2"><Input type="number" className="w-20" value={v.low_stock_alert ?? ""} onChange={(e) => update(i, { low_stock_alert: e.target.value ? Number(e.target.value) : null })} /></td>
                  <td className="p-2"><Switch checked={v.is_active} onCheckedChange={(x) => update(i, { is_active: x })} /></td>
                  <td className="p-2"><Button type="button" size="icon" variant="outline" onClick={() => remove(i)}><X className="h-3 w-3" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VariationImage({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await uploadFile(f, "variations")); }
    catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };
  if (value) return (
    <div className="relative h-12 w-12">
      <img src={value} className="h-12 w-12 rounded object-cover" alt="" />
      <button type="button" onClick={() => onChange("")} className="absolute -right-1 -top-1 rounded-full border bg-background p-0.5"><X className="h-3 w-3" /></button>
    </div>
  );
  return (
    <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded border-2 border-dashed text-[10px] text-muted-foreground hover:bg-muted">
      {busy ? "…" : <Upload className="h-3 w-3" />}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </label>
  );
}

/* -------- Media & scanner components -------- */

function ImageUploader({ images, onChange }: { images: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadFile(f, "images"));
      onChange([...images, ...urls]);
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Label>Product images</Label>
      <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed py-8 text-sm text-muted-foreground hover:bg-muted/50">
        <Upload className="h-4 w-4" />{busy ? "Uploading..." : "Click to upload or drag files"}
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </label>
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {images.map((url, i) => (
            <div key={url} className="group relative overflow-hidden rounded-md border">
              <img src={url} alt="" className="aspect-square w-full object-cover" />
              <button type="button" className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100" onClick={() => onChange(images.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
              {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">Main</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoUploader({ url, onChange }: { url: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try { onChange(await uploadFile(file, "videos")); toast.success("Video uploaded"); }
    catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <Label>Product video</Label>
      <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed py-6 text-sm text-muted-foreground hover:bg-muted/50">
        <Upload className="h-4 w-4" />{busy ? "Uploading..." : url ? "Replace video" : "Click to upload video"}
        <input type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {url && (
        <div className="mt-3 flex items-start gap-3">
          <video src={url} controls className="max-h-40 rounded-md border" />
          <Button type="button" variant="outline" size="sm" onClick={() => onChange("")}>Remove</Button>
        </div>
      )}
    </div>
  );
}

function BarcodeScanner({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  useEffect(() => {
    if (!open) return;
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    (async () => {
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, ctrl) => {
          if (cancelled) return;
          if (result) { onScan(result.getText()); toast.success(`Scanned: ${result.getText()}`); ctrl.stop(); setOpen(false); }
        });
        controlsRef.current = controls;
      } catch (e: any) { toast.error(e.message ?? "Camera unavailable"); setOpen(false); }
    })();
    return () => { cancelled = true; controlsRef.current?.stop(); };
  }, [open, onScan]);
  return (
    <div>
      {!open ? (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}><Camera className="mr-1 h-4 w-4" /> Scan with camera</Button>
      ) : (
        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><ScanLine className="h-4 w-4" /> Scanning…</div>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Stop</Button>
          </div>
          <video ref={videoRef} className="w-full max-w-md rounded-md bg-black" />
        </div>
      )}
    </div>
  );
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const v = draft.trim(); if (!v || values.includes(v)) return; onChange([...values, v]); setDraft(""); };
  return (
    <div className="rounded-md border p-2">
      <div className="flex flex-wrap gap-1">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">{v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
        <input className="flex-1 min-w-[120px] bg-transparent px-1 text-sm outline-none" value={draft} placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
          }} onBlur={add} />
      </div>
    </div>
  );
}

export function productRowToForm(p: any, variations: any[] = []): ProductFormValues {
  const vars: Variation[] = (variations ?? []).map((v) => ({
    id: v.id, name: v.name ?? "",
    attributes: (v.attributes ?? {}) as Record<string, string>,
    sku: v.sku ?? "", barcode: v.barcode ?? "",
    cost_price: v.cost_price ?? null, price: Number(v.price ?? 0),
    discount_price: v.discount_price ?? null,
    stock: Number(v.stock ?? 0), low_stock_alert: v.low_stock_alert ?? null,
    image_url: v.image_url ?? "", is_active: v.is_active ?? true,
  }));
  // Rebuild selected_attributes from variations
  const selMap = new Map<string, Set<string>>();
  for (const v of vars) for (const [k, x] of Object.entries(v.attributes)) {
    if (!selMap.has(k)) selMap.set(k, new Set());
    selMap.get(k)!.add(x);
  }
  return {
    ...emptyProduct, ...p,
    product_type: (p.product_type ?? "simple") as "simple" | "variable",
    brand: p.brand ?? "", supplier_id: p.supplier_id ?? "",
    tag: p.tag ?? "", subcategory: p.subcategory ?? "",
    description: p.description ?? "", video_url: p.video_url ?? "",
    seo_title: p.seo_title ?? "", seo_description: p.seo_description ?? "",
    weight_unit: p.weight_unit ?? "g",
    cost_price: p.cost_price ?? null, tax_percent: p.tax_percent ?? null,
    stock: p.stock ?? 0, low_stock_alert: p.low_stock_alert ?? null,
    images: p.images ?? [], tags: p.tags ?? [], seo_keywords: p.seo_keywords ?? [],
    specifications: p.specifications
      ? Object.entries(p.specifications).map(([key, value]) => ({ key, value: String(value) }))
      : [],
    selected_attributes: [...selMap.entries()].map(([name, vals]) => ({ attribute_id: name, name, values: [...vals] })),
    variations: vars,
  };
}
