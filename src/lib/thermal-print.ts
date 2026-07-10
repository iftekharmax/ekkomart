// Opens a 58/80mm-friendly thermal receipt in a new window and triggers print.
type Item = { name: string; qty: number; price: number };
type Sale = {
  invoice: string;
  created_at: string;
  customer?: string | null;
  payment_method?: string;
  items: Item[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
};

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

export function printThermalReceipt(sale: Sale) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return;
  const rows = sale.items.map((it) => `
    <tr>
      <td class="l">${esc(it.name)}<div class="muted">${it.qty} × ${money(it.price)}</div></td>
      <td class="r">${money(it.qty * it.price)}</td>
    </tr>`).join("");

  const change = Math.max(0, (sale.paid || 0) - sale.total);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoice)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; color: #000; margin: 0; padding: 6px; width: 72mm; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  .center { text-align: center; }
  .muted { color: #555; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .l { text-align: left; } .r { text-align: right; white-space: nowrap; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; }
  .total { font-size: 14px; font-weight: 700; }
</style></head><body>
  <h1>Receipt</h1>
  <div class="center muted">${esc(sale.invoice)}</div>
  <div class="center muted">${new Date(sale.created_at).toLocaleString()}</div>
  <hr/>
  <div class="row"><span>Customer</span><span>${esc(sale.customer || "Walk-in")}</span></div>
  <div class="row"><span>Payment</span><span style="text-transform:capitalize">${esc(sale.payment_method || "cash")}</span></div>
  <hr/>
  <table>${rows}</table>
  <hr/>
  <div class="row"><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
  <div class="row"><span>Discount</span><span>-${money(sale.discount)}</span></div>
  <div class="row"><span>Tax</span><span>${money(sale.tax)}</span></div>
  <div class="row total"><span>Total</span><span>${money(sale.total)}</span></div>
  <div class="row"><span>Paid</span><span>${money(sale.paid)}</span></div>
  <div class="row"><span>Change</span><span>${money(change)}</span></div>
  <hr/>
  <div class="center muted">Thank you!</div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
