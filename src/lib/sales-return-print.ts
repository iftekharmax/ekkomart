// Print/PDF receipt for a sales return — mirrors the modern sales detail layout.
type Item = { name: string; qty: number; price: number };
export type ReturnReceipt = {
  reference: string;
  return_date: string;
  created_at?: string;
  customer?: string | null;
  reason?: string | null;
  notes?: string | null;
  status?: string;
  staff?: string | null;
  voided_by_name?: string | null;
  voided_at?: string | null;
  items: Item[];
  subtotal: number;
  total: number;
};

function esc(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

export function printSalesReturnReceipt(r: ReturnReceipt) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) return;
  const status = (r.status || "completed").toUpperCase();
  const voided = status === "VOIDED";
  const rows = r.items.map((it, i) => `
    <tr>
      <td class="idx">${i + 1}</td>
      <td>${esc(it.name)}</td>
      <td class="r">৳${it.price.toFixed(2)}</td>
      <td class="r">${it.qty}</td>
      <td class="r b">৳${(it.qty * it.price).toFixed(2)}</td>
    </tr>`).join("");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Return ${esc(r.reference)}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#111; margin:0; padding:0; }
    .wrap { max-width: 780px; margin: 0 auto; padding: 18px; }
    .top { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; border-bottom:2px solid #111; padding-bottom:14px; }
    .brand h1 { margin:0; font-size:24px; letter-spacing:2px; }
    .brand .sub { color:#555; font-size:12px; margin-top:4px; }
    .meta { text-align:right; font-size:12px; }
    .meta .tag { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:1px;
      background:${voided ? "#f1f1f1" : "#dcfce7"}; color:${voided ? "#666" : "#166534"}; margin-bottom:6px; }
    .meta .ref { font-family: 'Courier New', monospace; font-weight:700; font-size:14px; }
    h2 { font-size:14px; margin:18px 0 8px; text-transform:uppercase; letter-spacing:1.5px; color:#333; }
    .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; font-size:12px; }
    .grid .k { color:#666; font-size:10px; text-transform:uppercase; letter-spacing:1px; }
    .grid .v { font-weight:600; margin-top:2px; }
    table { width:100%; border-collapse:collapse; margin-top:6px; font-size:13px; }
    th { text-align:left; background:#f6f6f6; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:1px; border-bottom:1px solid #ddd; }
    td { padding:8px 10px; border-bottom:1px solid #eee; vertical-align:top; }
    .r { text-align:right; }
    .b { font-weight:700; }
    td.idx { color:#888; width:24px; }
    .totals { margin-top:10px; margin-left:auto; width:280px; font-size:13px; }
    .totals .row { display:flex; justify-content:space-between; padding:4px 0; }
    .totals .row.total { border-top:2px solid #111; margin-top:4px; padding-top:8px; font-size:16px; font-weight:800; }
    .notes { margin-top:16px; padding:12px 14px; background:#fafafa; border-left:3px solid #111; font-size:12px; }
    .notes .k { color:#666; text-transform:uppercase; letter-spacing:1px; font-size:10px; }
    .foot { margin-top:26px; text-align:center; color:#666; font-size:11px; border-top:1px dashed #ccc; padding-top:10px; }
  </style></head><body>
    <div class="wrap">
      <div class="top">
        <div class="brand">
          <h1>TOKYOHALAL</h1>
          <div class="sub">Halal Food &amp; Grocery · Dhaka, Bangladesh</div>
        </div>
        <div class="meta">
          <div class="tag">${status} · SALES RETURN</div>
          <div class="ref">${esc(r.reference)}</div>
          <div style="color:#666;margin-top:2px">${new Date(r.created_at || Date.now()).toLocaleString()}</div>
        </div>
      </div>

      <h2>Return details</h2>
      <div class="grid">
        <div><div class="k">Return date</div><div class="v">${esc(r.return_date)}</div></div>
        <div><div class="k">Customer</div><div class="v">${esc(r.customer || "Walk-in")}</div></div>
        <div><div class="k">Processed by</div><div class="v">${esc(r.staff || "System")}</div></div>
        <div><div class="k">Total refund</div><div class="v">৳${r.total.toFixed(2)}</div></div>
      </div>
      ${voided && r.voided_by_name ? `<div class="notes"><div class="k">Voided by</div><div>${esc(r.voided_by_name)}${r.voided_at ? " · " + new Date(r.voided_at).toLocaleString() : ""}</div></div>` : ""}

      <h2>Items returned</h2>
      <table>
        <thead><tr><th>#</th><th>Item</th><th class="r">Price</th><th class="r">Qty</th><th class="r">Subtotal</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="row"><span>Subtotal</span><span>৳${r.subtotal.toFixed(2)}</span></div>
        <div class="row total"><span>Total refund</span><span>৳${r.total.toFixed(2)}</span></div>
      </div>

      ${r.reason ? `<div class="notes"><div class="k">Reason</div><div>${esc(r.reason)}</div></div>` : ""}
      ${r.notes ? `<div class="notes"><div class="k">Notes</div><div>${esc(r.notes)}</div></div>` : ""}

      <div class="foot">Stock has been restored to inventory · Keep this receipt for your records</div>
    </div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 400); }, 300);
}
