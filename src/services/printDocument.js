// Plumbing shared by the printable order documents (order sheet, tax invoice).
//
// The app chrome (sidebar, filters, toolbars) must not end up on the page, so
// rather than calling window.print() on the SPA we build a self-contained
// document and print that from a hidden iframe. An iframe is used instead of
// window.open() because popup blockers routinely kill the latter.

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

// Order data is user-supplied (product names, customer names, notes), so every
// interpolated value goes through this.
export function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])
}

export function formatAddress(snapshot) {
  if (!snapshot) return '—'
  if (typeof snapshot === 'string') return snapshot
  const parts = [
    snapshot.line1 ?? snapshot.address_line_1 ?? snapshot.street,
    snapshot.line2 ?? snapshot.address_line_2,
    snapshot.city,
    snapshot.state ?? snapshot.province,
    snapshot.postal_code ?? snapshot.zip,
    snapshot.country,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

/**
 * Prints a finished HTML document. Resolves once the print dialog has been
 * dismissed (or shortly after, in browsers that do not fire `afterprint`).
 *
 * @param {string} html A complete document, including its own <style>.
 * @param {string} frameTitle Accessible title for the throwaway iframe.
 */
export function printHtmlDocument(html, frameTitle) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.title = frameTitle
    // Off-screen rather than display:none — a hidden frame will not print.
    Object.assign(frame.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '1px',
      height: '1px',
      opacity: '0',
      border: '0',
    })

    let settled = false
    const cleanup = () => {
      if (settled) return
      settled = true
      // Removing the frame while the dialog is still open cancels the job in
      // some browsers, so this is always deferred.
      setTimeout(() => frame.remove(), 500)
      resolve()
    }

    frame.onload = () => {
      const win = frame.contentWindow
      if (!win) {
        cleanup()
        return
      }
      win.addEventListener('afterprint', cleanup, { once: true })
      win.focus()
      win.print()
      // Safety net for browsers that never fire afterprint.
      setTimeout(cleanup, 60_000)
    }

    // srcdoc rather than document.write() — the latter is deprecated, and this
    // gives a reliable single load event to hook onto.
    frame.srcdoc = html
    document.body.appendChild(frame)
  })
}
