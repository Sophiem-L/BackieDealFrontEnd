// The navigation decision, extracted from the router so it can be unit tested
// without mounting one. Returns a redirect target, or null to allow.
//
// `auth` is passed in rather than imported so the tests can supply a plain
// object instead of standing up Pinia.
export function resolveAccess(to, auth) {
  // Authentication first: an expired session should land on login, not on a
  // misleading "you are not allowed" page.
  if (!to.meta?.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' }
  }

  // Hiding a nav item is not access control — a typed URL must be refused too.
  if (to.meta?.permission && !auth.hasPermission(to.meta.permission)) {
    return { name: 'forbidden' }
  }

  return null
}
