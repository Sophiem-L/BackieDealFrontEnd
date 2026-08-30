// Single source of truth for "may this user do X". The sidebar, the router
// guard and in-view action buttons all ask through here, so there is one
// behaviour to test and one place to change.
//
// Both functions are pure and take the permission list as their first
// argument: that keeps them free of Pinia and vue-router, so they can be unit
// tested directly. The auth store wraps them with the current user's list.
//
// The list is `user.permissions` from POST /admin/auth/login and
// GET /admin/auth/me — the caller's flattened role + direct grants.

// A missing or malformed list denies everything. A session persisted before
// the API carried permissions has no list, and must not read as full access.
export function can(permissions, permission) {
  if (!permission) return true
  if (!Array.isArray(permissions)) return false
  return permissions.includes(permission)
}

// True when the user holds at least one of `required`. An empty requirement
// list means the thing being gated is unrestricted.
export function canAny(permissions, required) {
  if (!Array.isArray(required) || required.length === 0) return true
  return required.some((permission) => can(permissions, permission))
}
