// Renders one order as a standalone printable order sheet.
//
// This is the order record — reference, placement date, status, customer, line
// items, fulfilment and amounts — not a billing invoice, so there is no
// "billed to" / amount-due framing. The tax invoice is printInvoice.js.
//
// The document is printed through printDocument.js, which keeps the app chrome
// off the page.

import { escapeHtml as esc, formatAddress, printHtmlDocument } from '@/services/printDocument'

function money(value, code) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return code && code !== 'USD' ? `${formatted} ${code}` : `$${formatted}`
}

function humanise(value) {
  if (!value) return '—'
  return String(value)
    .split(/[_\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const PAYMENT_METHOD_LABELS = {
  cod: 'Cash on Delivery',
  bank_transfer: 'Bank Transfer',
  stripe: 'Card (Stripe)',
  paypal: 'PayPal',
}

export function buildOrderHtml(order) {
  const code = order?.currency
  const reference =
    order?.order_number || (order?.id ? `#${String(order.id).slice(0, 8).toUpperCase()}` : '—')
  const items = Array.isArray(order?.items) ? order.items : []
  const method = order?.payment?.method

  // Carrier + tracking number, when the order has actually shipped.
  const trackingNumber = order?.tracking?.number
  const trackingProvider = order?.tracking?.provider
  const trackingSuffix = trackingNumber
    ? esc(` · ${trackingProvider ? `${trackingProvider} ` : ''}${trackingNumber}`)
    : ''

  const rows = items.length
    ? items
        .map(
          (item) => `
        <tr>
          <td>
            <div class="prod">${esc(item?.product?.name ?? 'Unknown product')}</div>
            <div class="sku">${esc(item?.product?.sku ?? '—')}</div>
          </td>
          <td class="num">${esc(item?.qty ?? 0)}</td>
          <td class="num">${esc(money(item?.unit_price, code))}</td>
          <td class="num strong">${esc(money(item?.line_total, code))}</td>
        </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">This order has no line items.</td></tr>'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Order ${esc(reference)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    color: #1f242d;
    font-size: 12px;
    line-height: 1.5;
  }
  h1 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 2px solid #f4c10f; padding-bottom: 12px; }
  .ref { margin: 4px 0 0; font-size: 13px; font-weight: 700; color: #a8850a; }
  .meta { margin: 2px 0 0; color: #6b7280; font-size: 11px; }
  .chip { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; background: #eef0f3; color: #5b6474; }
  .chip--pending { background: #fff2d6; color: #b8890b; }
  .chip--processing { background: #fdf3d0; color: #a8780a; }
  .chip--completed { background: #e6f7ee; color: #1f9d57; }
  .chip--cancelled { background: #fdecec; color: #d14343; }
  .cols { display: flex; gap: 24px; margin-top: 18px; }
  .col { flex: 1; }
  .label { margin: 0 0 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #9099a6; }
  .val { margin: 0; }
  .muted { color: #6b7280; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { text-align: left; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: #9099a6; border-bottom: 1px solid #e6e8ec; padding: 6px 8px; }
  td { padding: 8px; border-bottom: 1px solid #eef0f3; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .strong { font-weight: 700; }
  .prod { font-weight: 600; }
  .sku { color: #9099a6; font-size: 10px; }
  .empty { text-align: center; color: #9099a6; padding: 20px; }
  .totals { margin: 14px 0 0 auto; width: 260px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { border-top: 2px solid #1f242d; margin-top: 6px; padding-top: 8px; font-size: 14px; font-weight: 800; }
  footer { margin-top: 28px; border-top: 1px solid #eef0f3; padding-top: 10px; color: #9099a6; font-size: 10px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>Order</h1>
      <p class="ref">${esc(reference)}</p>
      <p class="meta">Placed ${esc(formatDate(order?.created_at))}</p>
    </div>
    <span class="chip chip--${esc(order?.status ?? '')}">${esc(humanise(order?.status))}</span>
  </div>

  <div class="cols">
    <div class="col">
      <p class="label">Customer</p>
      <p class="val strong">${esc(order?.customer?.name || order?.customer?.email || '—')}</p>
      <p class="val muted">${esc(order?.customer?.email || '—')}</p>
      <p class="val muted">${esc(order?.customer?.phone || '—')}</p>
    </div>
    <div class="col">
      <p class="label">Delivery</p>
      <p class="val muted">${esc(formatAddress(order?.shipping_address))}</p>
      <p class="val muted">${esc(humanise(order?.tracking?.status))}${trackingSuffix}</p>
    </div>
    <div class="col">
      <p class="label">Payment</p>
      <p class="val">${esc(method ? (PAYMENT_METHOD_LABELS[method] ?? humanise(method)) : '—')}</p>
      <p class="val muted">${esc(humanise(order?.payment?.status))}</p>
      <p class="val muted">${esc(order?.payment?.transaction_id || '—')}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Subtotal</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span class="muted">Subtotal</span><span>${esc(money(order?.subtotal, code))}</span></div>
    <div><span class="muted">Discount${
      order?.coupon?.code ? ` (${esc(order.coupon.code)})` : ''
    }</span><span>${esc(money(order?.discount_total, code))}</span></div>
    <div><span class="muted">Tax</span><span>${esc(money(order?.tax_total, code))}</span></div>
    <div><span class="muted">Shipping</span><span>${esc(money(order?.shipping_total, code))}</span></div>
    <div class="grand"><span>Total</span><span>${esc(money(order?.total, code))}</span></div>
  </div>

  <footer>Generated ${esc(formatDate(new Date().toISOString()))} · Beckie Deal admin</footer>
</body>
</html>`
}

/**
 * Prints a single order. Resolves once the print dialog has been dismissed
 * (or immediately after, in browsers that do not fire `afterprint`).
 *
 * @param {object} order The order payload from GET /admin/orders/{uuid}.
 */
export function printOrderDocument(order) {
  return printHtmlDocument(buildOrderHtml(order), 'Order print frame')
}
