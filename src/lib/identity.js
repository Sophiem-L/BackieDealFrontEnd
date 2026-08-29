// How the signed-in admin is labelled in the UI.
//
// Pure like src/lib/permissions.js: no Pinia, no router, so the header, the
// sidebar and the profile page all read one identity from one place and it can
// be unit tested directly.
//
// The user shape is whatever POST /admin/auth/login and GET /admin/auth/me
// return: { first_name?, last_name?, name?, email?, roles: string[] }. Login
// sends only `name`; /auth/me adds the split fields, so both must work.

// Prefer the split fields — they are what the profile screen edits, so they are
// the ones that are fresh after a rename.
export function userDisplayName(user) {
  if (!user) return ''
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || user.name?.trim() || user.email?.trim() || ''
}

// 'super-admin' -> 'Super Admin'. Roles arrive as backend slugs; showing them
// raw is how "manager" ends up next to a person's name in title case text.
export function roleLabel(role) {
  return String(role ?? '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// A user can hold more than one role; the chip lists them all rather than
// silently picking one.
export function userRoleLabel(user) {
  const roles = user?.roles
  if (!Array.isArray(roles)) return ''
  return roles.map(roleLabel).filter(Boolean).join(', ')
}

export function initialsFrom(name) {
  const parts = String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  return letters.toUpperCase()
}
