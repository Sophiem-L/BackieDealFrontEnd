// Renders one order as a bilingual (Khmer / English) Tax Invoice, A4 portrait.
//
// The amounts follow the order rather than a flat 10% on the item prices: the
// Grand Total is always what the order charged, VAT is the order's own
// tax_total, and the item rows are shown before VAT so they add up to
// "Total before VAT". That holds whether the store's prices include VAT (the
// default) or not, because we never have to know which — see buildInvoiceModel.
//
// Fixed company text (seller, bank accounts, warranty notes) is copied from the
// shop's own invoice sample and lives in the constants below.

import { escapeHtml as esc, formatAddress, printHtmlDocument } from '@/services/printDocument'

export const INVOICE_SELLER = {
  nameKh: 'បេកគីឌៀល កុំព្យូទ័រ',
  nameEn: 'BECKIE DEAL COMPUTER',
  vattin: 'K005-902105220',
  addressKh: 'ផ្ទះលេខ 519Eo ផ្លូវ កម្ពុជាក្រោម(128) សង្កាត់ផ្សារដេប៉ូទី៣ ខណ្ឌទួលគោក រាជធានីភ្នំពេញ',
  // Not on the sample we were given. The line stays off the invoice until this
  // is filled in, rather than printing a placeholder on a tax document.
  phone: '',
  website: 'www.beckie-khmer.com',
}

const BANK_ACCOUNTS = [
  { bank: 'ABA Bank', accountName: 'CHEA VASNA', accountNumber: '092 747 456' },
  { bank: 'ACLEDA BANK', accountName: 'CHEA VASNA', accountNumber: '36000447038118' },
]

const NOTES = [
  {
    kh: 'ធានាមួយឆ្នាំលើគ្រឿងបន្លាស់ និងសេវាកម្ម (សំរាប់កុំព្យូទ័រ)។',
    en: 'One Year Warranty on Part and Service (for Computer only).',
  },
  {
    kh: 'មិនធានាលើករណីបាត់បង់លក្ខណៈដើម ធ្លាក់ បាក់បែក ប្រើប្រាស់មិនត្រឹមត្រូវ ចូលទឹក ទេះ ឬកម្មវិធីកុំព្យូទ័រ។',
    en: 'Warranty does not cover any malfunction, dropped, damaged, improper handling, liquid spills, inadequate ventilation and Software.',
  },
  {
    kh: 'ទំនិញដែលទិញរួច មិនអាចដូរយកលុយវិញបានទេ។',
    en: 'Goods sold are not refundable',
  },
]

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩'

// The amounts below are worked in whole cents so nothing drifts by a fraction.
function cents(value) {
  const n = Math.round(Number(value) * 100)
  return Number.isFinite(n) ? n : 0
}

/**
 * Splits `target` cents across `weights` in proportion to them, so the parts
 * add up to the target exactly (largest-remainder rounding). Rounding each row
 * on its own would leave the rows a cent or two off the total.
 */
function allocateCents(weights, target) {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return weights.slice()

  const exact = weights.map((weight) => (weight * target) / total)
  const parts = exact.map(Math.floor)
  let left = target - parts.reduce((sum, part) => sum + part, 0)

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - parts[index] }))
    .sort((a, b) => b.fraction - a.fraction)
  for (const { index } of byFraction) {
    if (left <= 0) break
    parts[index] += 1
    left -= 1
  }
  return parts
}

// The order only stores the VAT amount, so the percentage is worked back from
// it, over the goods it was charged on (shipping is not taxed). Tax is rounded
// to the cent, so a small order drifts (a $1 order comes out at 9.89%); snap to
// a whole percent when it is that close.
function vatRate(vat, goods) {
  if (vat <= 0 || goods <= 0) return 0
  const rate = (vat / goods) * 100
  const whole = Math.round(rate)
  return Math.abs(rate - whole) < 0.25 ? whole : Math.round(rate * 100) / 100
}

/** The rate the user typed, as a positive number, or null when it is unusable. */
export function parseExchangeRate(input) {
  const n = Number(String(input ?? '').replace(/,/g, '').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

const RATE_STORAGE_KEY = 'invoice.exchangeRate'

// The rate moves day to day, so the last one used is only a starting point.
export function loadInvoiceExchangeRate() {
  try {
    return window.localStorage.getItem(RATE_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveInvoiceExchangeRate(rate) {
  try {
    window.localStorage.setItem(RATE_STORAGE_KEY, String(rate))
  } catch {
    // Storage can be blocked (private window); the next print just asks again.
  }
}

/**
 * The invoice is laid out in US dollars with a riel conversion underneath, so
 * an order priced in anything else would print wrong labels and amounts.
 * Returns a message for the user, or '' when the order can be invoiced.
 */
export function invoiceCurrencyProblem(order) {
  const code = order?.currency
  if (!code || code === 'USD') return ''
  return `This order is in ${code}. The tax invoice only supports US dollar orders.`
}

/**
 * Works out everything the invoice prints from the order payload.
 *
 * The three figures that matter are what the order charged (Grand Total), its
 * VAT, and its shipping. Total before VAT is simply Grand Total − VAT, so the
 * invoice always adds up. The goods rows (items, plus any order-level discount)
 * are scaled to fill Total before VAT − shipping: that scale is 1 when prices
 * were VAT-exclusive, and strips the VAT back out when they were inclusive.
 *
 * @param {object} order The order payload from GET /admin/orders/{uuid}.
 * @param {number|string|null} exchangeRate KHR per US$1.
 */
export function buildInvoiceModel(order, exchangeRate) {
  const orderItems = Array.isArray(order?.items) ? order.items : []
  const grand = cents(order?.total)
  const vat = cents(order?.tax_total)
  const shipping = cents(order?.shipping_total)

  // `discount_total` is the promotions already taken off the line totals plus
  // any order-level discount (coupon, or keyed in). Only the latter is still to
  // be subtracted from the lines.
  const lineDiscounts = orderItems.reduce((sum, item) => sum + cents(item?.discount), 0)
  const orderDiscount = Math.max(0, cents(order?.discount_total) - lineDiscounts)

  const goods = orderItems.map((item) => ({
    description: item?.product?.name ?? 'Unknown product',
    sku: item?.product?.sku ?? '',
    qty: Number(item?.qty ?? 0),
    gross: cents(item?.line_total),
  }))
  if (orderDiscount > 0) {
    goods.push({
      description: order?.coupon?.code ? `Discount (${order.coupon.code})` : 'Discount',
      sku: '',
      qty: 1,
      gross: -orderDiscount,
    })
  }

  const beforeVat = grand - vat
  const goodsNet = beforeVat - shipping
  const nets = allocateCents(
    goods.map((row) => row.gross),
    goodsNet,
  )

  const rows = goods.map((row, index) => ({
    description: row.description,
    sku: row.sku,
    qty: row.qty,
    unit: row.qty > 0 ? Math.round(nets[index] / row.qty) : nets[index],
    amount: nets[index],
  }))
  if (shipping > 0) {
    rows.push({
      description: order?.shipping_method?.name
        ? `Shipping (${order.shipping_method.name})`
        : 'Shipping',
      sku: '',
      qty: 1,
      unit: shipping,
      amount: shipping,
    })
  }

  const rate = parseExchangeRate(exchangeRate)
  return {
    reference:
      order?.order_number || (order?.id ? `#${String(order.id).slice(0, 8).toUpperCase()}` : ''),
    date: order?.created_at ?? null,
    customerName:
      order?.customer?.name || order?.shipping_address?.full_name || order?.customer?.email || '',
    address: formatAddress(order?.shipping_address),
    rows,
    totals: {
      beforeVat,
      vat,
      vatRate: vatRate(vat, goodsNet),
      grand,
      exchangeRate: rate,
      // Riel is rounded to the nearest 100, as on the shop's sample.
      grandRiel: rate === null ? null : Math.round(((grand / 100) * rate) / 100) * 100,
    },
  }
}

function usd(amountCents) {
  const abs = (Math.abs(amountCents) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${amountCents < 0 ? '-' : ''}$ ${abs}`
}

function khmerNumber(value) {
  return String(value).replace(/\d/g, (digit) => KHMER_DIGITS[digit])
}

// dd-MM-yyyy, on the shop's own calendar rather than the viewer's.
function invoiceDate(iso) {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Phnom_Penh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date)
  const part = (type) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('day')}-${part('month')}-${part('year')}`
}

const STYLES = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #111;
    font-family: 'Khmer UI', 'Leelawadee UI', 'Khmer OS Battambang', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .en { font-family: Arial, sans-serif; }

  .hd { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 14px; }
  .hd img { width: 108px; height: 108px; object-fit: contain; }
  .hd .kh { font-size: 38px; font-weight: 700; text-align: center; line-height: 1.15; }
  .hd .name-en { font-size: 28px; font-weight: 800; letter-spacing: .01em; text-align: center; font-family: Arial, sans-serif; }
  .seller { margin-top: 8px; padding-bottom: 6px; border-bottom: 2px solid #111; }
  .seller div { margin: 1px 0; }
  .ttl { text-align: center; margin: 8px 0 2px; font-weight: 700; }
  .ttl .kh { font-size: 17px; }
  .ttl .en { font-size: 13px; }
  .ref { text-align: right; font-size: 11px; margin-bottom: 4px; }

  .cust { display: grid; grid-template-columns: 190px 1fr auto; gap: 4px 10px; margin: 6px 0 8px; align-items: start; }
  .cust .span { grid-column: 2 / 4; }
  .cust .when { text-align: right; white-space: nowrap; font-size: 11px; }
  .cust .lbl small { display: block; font-size: 10px; color: #444; font-family: Arial, sans-serif; }
  .cust .vat { min-height: 20px; border-bottom: 1px dotted #777; }

  table.items { width: 100%; table-layout: fixed; border-collapse: collapse; border: 1px solid #111; height: 230px; }
  table.items th { border: 1px solid #111; padding: 4px 6px; font-weight: 600; text-align: center; font-size: 11px; }
  table.items th small { display: block; font-weight: 400; font-size: 10px; font-family: Arial, sans-serif; }
  table.items td { border-left: 1px solid #111; border-right: 1px solid #111; padding: 6px; vertical-align: top; }
  table.items tr { break-inside: avoid; }
  table.items td.num { text-align: right; white-space: nowrap; }
  table.items td.mid { text-align: center; }
  table.items tr.fill { height: 100%; }
  table.items .sku { color: #555; font-size: 10px; font-family: Arial, sans-serif; }

  .lower { display: grid; grid-template-columns: 1fr calc(var(--c-qty) + var(--c-unit) + var(--c-amt) + 1px); break-inside: avoid; }
  .notes { padding: 6px 10px 0 2px; }
  .notes p { margin: 0 0 5px; line-height: 1.35; }
  .notes .kh-n { display: block; font-size: 10.5px; }
  .notes .en-n { display: block; font-size: 9.5px; font-family: Arial, sans-serif; }
  .pay { margin-top: 6px; font-size: 13px; line-height: 1.45; font-family: 'Times New Roman', Times, serif; width: fit-content; }

  .tot { align-self: start; border: 1px solid #111; border-top: 0; border-collapse: collapse; table-layout: fixed; width: 100%; font-size: 11px; }
  .tot td { border-top: 1px solid #111; padding: 4px 6px; }
  .tot td:first-child { border-right: 1px solid #111; }
  .tot td:last-child { text-align: right; white-space: nowrap; font-weight: 600; }
  .tot small { font-family: Arial, sans-serif; font-size: 9.5px; }

  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 18px; break-inside: avoid; }
  .sign .space { height: 80px; }
  .sign .line { border-top: 1px solid #111; margin-top: 2px; }
  .sign .cap { text-align: center; padding-top: 3px; }
  .sign .cap b { display: block; font-family: Arial, sans-serif; font-size: 11px; }
`

// The totals box sits under Quantity + Unit Price + Amount: its left edge is the
// Quantity column's line and its value column is the Amount column. The widths
// are shared through these variables so the two tables cannot drift apart.
const COLUMN_WIDTHS = '--c-no: 44px; --c-qty: 78px; --c-unit: 104px; --c-amt: 122px;'

/**
 * @param {object} order The order payload from GET /admin/orders/{uuid}.
 * @param {{ exchangeRate?: number|string|null, logoUrl?: string }} [options]
 */
export function buildInvoiceHtml(order, { exchangeRate = null, logoUrl = '/image/logo.png' } = {}) {
  const model = buildInvoiceModel(order, exchangeRate)
  const { totals } = model
  const seller = INVOICE_SELLER

  const itemRows = model.rows
    .map(
      (row, index) => `
          <tr>
            <td class="mid">${index + 1}</td>
            <td><b class="en">${esc(row.description)}</b>${
              row.sku ? `<div class="sku">SKU: ${esc(row.sku)}</div>` : ''
            }</td>
            <td class="num mid">${esc(row.qty)}</td>
            <td class="num">${esc(usd(row.unit))}</td>
            <td class="num">${esc(usd(row.amount))}</td>
          </tr>`,
    )
    .join('')

  const notes = NOTES.map(
    (note) =>
      `<p><span class="kh-n">•${esc(note.kh)}</span><span class="en-n">${esc(note.en)}</span></p>`,
  ).join('\n            ')

  const bankLines = BANK_ACCOUNTS.map(
    (account) => `
            <div>Bank Name: ${esc(account.bank)}</div>
            <div><b>Account Name : ${esc(account.accountName)}</b></div>
            <div>Account Number : ${esc(account.accountNumber)}</div>`,
  ).join('')

  const vatLabel = `${totals.vatRate}%`
  const riel = (value) => (value === null ? '—' : `KHR ${value.toLocaleString('en-US')}`)
  const rate =
    totals.exchangeRate === null
      ? '—'
      : `KHR ${totals.exchangeRate.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`

  return `<!doctype html>
<html lang="km">
<head>
<meta charset="utf-8">
<title>Tax Invoice ${esc(model.reference)}</title>
<style>${STYLES}</style>
</head>
<body style="${COLUMN_WIDTHS}">
  <div class="hd">
    <img src="${esc(logoUrl)}" alt="Beckie Deal logo">
    <div>
      <div class="kh">${esc(seller.nameKh)}</div>
      <div class="name-en">${esc(seller.nameEn)}</div>
    </div>
  </div>

  <div class="seller">
    <div>លេខអត្តសញ្ញាណកម្ម អតប(VATTIN): <b>${esc(seller.vattin)}</b></div>
    <div>អាសយដ្ឋាន ៖ ${esc(seller.addressKh)}</div>${
      seller.phone ? `\n    <div>ទូរស័ព្ទលេខ: <span class="en">${esc(seller.phone)}</span></div>` : ''
    }
    <div class="en">Website : ${esc(seller.website)}</div>
  </div>

  <div class="ttl"><div class="kh">វិក្កយបត្រអាករ</div><div class="en">TAX INVOICE</div></div>
  <div class="ref">លេខរៀងវិក្កយបត្រ៖ <b>${esc(model.reference)}</b></div>

  <div class="cust">
    <div class="lbl">ឈ្មោះក្រុមហ៊ុនឬអតិថិជន<small>Company Name / Customer</small></div>
    <div><b>${esc(model.customerName)}</b></div>
    <div class="when">កាលបរិច្ឆេទ៖ <b>${esc(invoiceDate(model.date))}</b></div>
    <div class="lbl">អាសយដ្ឋាន<small>Address</small></div>
    <div class="span">${esc(model.address)}</div>
    <div class="lbl">លេខអត្តសញ្ញាណកម្ម អតប(VATTIN)</div>
    <div class="vat span"></div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:var(--c-no)">ល.រ<small>N°</small></th>
        <th>បរិយាយមុខទំនិញ<small>Description</small></th>
        <th style="width:var(--c-qty)">បរិមាណ<small>Quantity</small></th>
        <th style="width:var(--c-unit)">ថ្លៃឯកតា<small>Unit Price</small></th>
        <th style="width:var(--c-amt)">ថ្លៃទំនិញ<small>Amount</small></th>
      </tr>
    </thead>
    <tbody>${itemRows}
      <tr class="fill"><td></td><td></td><td></td><td></td><td></td></tr>
    </tbody>
  </table>

  <div class="lower">
    <div class="left">
      <div class="notes">
        ${notes}
      </div>

      <div class="pay">
        <div>Payment Note: Cash, Transfer or Check by this Name</div>${bankLines}
      </div>
    </div>
    <table class="tot">
      <colgroup><col style="width:calc(var(--c-qty) + var(--c-unit))"><col style="width:var(--c-amt)"></colgroup>
      <tr><td>សរុបមុនអាករ<br><small>Total before VAT</small></td><td>${esc(usd(totals.beforeVat))}</td></tr>
      <tr><td>អាករលើតម្លៃបន្ថែម${esc(khmerNumber(vatLabel))}<br><small>VAT ${esc(vatLabel)}</small></td><td>${esc(usd(totals.vat))}</td></tr>
      <tr><td>សរុបរួម ដុល្លារ<br><small>Grand Total USD</small></td><td>${esc(usd(totals.grand))}</td></tr>
      <tr><td>អត្រាប្តូរប្រាក់ជារៀល<br><small>Exchange Rate in Real</small></td><td>${esc(rate)}</td></tr>
      <tr><td>ទឹកប្រាក់សរុបជារៀល<br><small>Grand Total in Real</small></td><td>${esc(riel(totals.grandRiel))}</td></tr>
    </table>
  </div>

  <div class="sign">
    <div>
      <div class="space"></div>
      <div class="line"></div>
      <div class="cap">ហត្ថលេខា និងឈ្មោះអ្នកទិញ<b>Customer's Signature &amp; Name</b></div>
    </div>
    <div>
      <div class="space"></div>
      <div class="line"></div>
      <div class="cap">ហត្ថលេខា និងឈ្មោះអ្នកលក់<b>Seller's Signature &amp; Name</b></div>
    </div>
  </div>
</body>
</html>`
}

/**
 * Prints the tax invoice for one order. Resolves once the print dialog has been
 * dismissed.
 *
 * @param {object} order The order payload from GET /admin/orders/{uuid}.
 * @param {{ exchangeRate: number }} options KHR per US$1, from parseExchangeRate.
 */
export function printInvoiceDocument(order, { exchangeRate }) {
  // Absolute, because the throwaway iframe's own base URL is not the app's.
  const logoUrl = new URL(`${import.meta.env.BASE_URL}image/logo.png`, window.location.origin).href
  return printHtmlDocument(
    buildInvoiceHtml(order, { exchangeRate, logoUrl }),
    'Tax invoice print frame',
  )
}
