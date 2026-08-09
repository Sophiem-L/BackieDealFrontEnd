// Shared value formatters.
//
// A single Intl.NumberFormat instance rather than one per component: constructing
// a formatter is the expensive part, and two tabs formatting money with separately
// built formatters is how "$1,958.98" and "US$1,958.98" end up on the same page.
export const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})
