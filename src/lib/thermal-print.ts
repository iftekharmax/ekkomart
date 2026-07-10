// Thermal receipt printer — mirrors the POS receipt design (80mm).
type Item = { name: string; qty: number; price: number };
export type ThermalSale = {
  invoice: string;
  created_at?: string;
  customer?: string | null;
  payment_method?: string;
  items: Item[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
};

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function printThermalReceipt(sale: ThermalSale) {
  const win = window.open("", "_blank", "width=380,height=720");
  if (!win) return;
  const method = (sale.payment_method || "cash").toString();
  const customer = sale.customer || "Walk-in";
  const change = Math.max(0, (sale.paid || 0) - sale.total);
  const itemsCount = sale.items.reduce((s, it) => s + it.qty, 0);
  const dt = new Date(sale.created_at || Date.now()).toLocaleString();

  const rows = sale.items.map((it, i) => `
    <tr class="it">
      <td class="idx">${i + 1}</td>
      <td class="n"><div class="nm">${escapeHtml(it.name)}</div><div class="m">${it.qty} × ৳${it.price.toFixed(2)}</div></td>
      <td class="a">৳${(it.qty * it.price).toFixed(2)}</td>
    </tr>`).join("");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(sale.invoice)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    html,body { margin:0; padding:0; background:#fff; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#000; padding:10px 10px 14px; width:80mm; font-size:12px; -webkit-font-smoothing:antialiased; }
    .c { text-align:center; }
    h1 { font-size:20px; margin:0; letter-spacing:3px; font-weight:900; }
    .tag { display:inline-block; margin-top:4px; padding:2px 8px; border:1px solid #000; border-radius:999px; font-size:9px; letter-spacing:2px; font-weight:700; text-transform:uppercase; }
    .addr { margin-top:4px; font-size:10px; color:#222; line-height:1.35; }
    .divider { border:none; border-top:1px dashed #000; margin:8px 0; }
    .solid { border:none; border-top:1.5px solid #000; margin:8px 0; }
    .meta { display:grid; grid-template-columns:auto 1fr; gap:2px 8px; font-size:11px; }
    .meta b { font-weight:700; }
    table { width:100%; border-collapse:collapse; }
    thead th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; padding:4px 0; border-bottom:1px solid #000; }
    thead th.a { text-align:right; }
    td { vertical-align:top; padding:5px 0; font-size:12px; }
    td.idx { width:16px; color:#555; font-size:10px; }
    td.a { text-align:right; white-space:nowrap; padding-left:6px; font-weight:700; }
    .nm { font-weight:700; line-height:1.25; }
    .m { color:#444; font-size:10px; margin-top:1px; }
    .row { display:flex; justify-content:space-between; font-size:12px; padding:2px 0; }
    .row.strong { font-weight:700; }
    .total-box { margin-top:6px; padding:8px 6px; background:#000; color:#fff; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-weight:900; }
    .total-box .lbl { font-size:11px; letter-spacing:2px; }
    .total-box .val { font-size:18px; }
    .pay { margin-top:6px; padding:6px 0; border-top:1px dashed #000; border-bottom:1px dashed #000; }
    .foot { margin-top:12px; text-align:center; font-size:11px; }
    .foot .thanks { font-weight:800; font-size:13px; letter-spacing:1px; }
    .foot .sub { color:#333; margin-top:2px; }
    .id { font-family: 'Courier New', monospace; font-size:10px; text-align:center; margin-top:2px; color:#333; }
  </style></head><body>
    <div class="c">
      <h1>TOKYOHALAL</h1>
      <div class="tag">Official Sale Receipt</div>
      <div class="addr">Halal Food & Grocery<br/>Dhaka, Bangladesh</div>
    </div>
    <hr class="solid"/>
    <div class="meta">
      <b>Date</b><span>${dt}</span>
      <b>Invoice</b><span>${escapeHtml(sale.invoice)}</span>
      <b>Customer</b><span>${escapeHtml(customer)}</span>
      <b>Payment</b><span>${escapeHtml(method.toUpperCase())}</span>
    </div>
    <hr class="divider"/>
    <table>
      <thead><tr><th>#</th><th>Item</th><th class="a">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr class="divider"/>
    <div class="row"><span>Items</span><span>${itemsCount}</span></div>
    <div class="row"><span>Subtotal</span><span>৳${sale.subtotal.toFixed(2)}</span></div>
    ${sale.discount ? `<div class="row"><span>Discount</span><span>− ৳${sale.discount.toFixed(2)}</span></div>` : ""}
    ${sale.tax ? `<div class="row"><span>Tax</span><span>+ ৳${sale.tax.toFixed(2)}</span></div>` : ""}
    <div class="total-box"><span class="lbl">TOTAL</span><span class="val">৳${sale.total.toFixed(2)}</span></div>
    <div class="pay">
      <div class="row strong"><span>Paid (${escapeHtml(method)})</span><span>৳${(sale.paid || 0).toFixed(2)}</span></div>
      <div class="row strong"><span>Change</span><span>৳${change.toFixed(2)}</span></div>
    </div>
    <div class="foot">
      <div class="thanks">Thank you for shopping!</div>
      <div class="sub">Please keep the receipt for exchange or return.</div>
      <div class="id">${escapeHtml(sale.invoice)}</div>
    </div>
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); setTimeout(() => win.close(), 300); }, 250);
}
