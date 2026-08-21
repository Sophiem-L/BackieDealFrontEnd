# Manager role permissions — scope the role and hide what it cannot do

**Date:** 2026-08-21
**Status:** Approved, ready for implementation

## Requirement

A user signing into the portal with the `manager` role may do exactly this and
nothing more:

- Login, reset password and logout
- Update account information
- Change password
- Manage Approval
- Manage Product
- Manage Slide
- Manage News
- Manage Content in website
- Manage Promotion
- Manage product category

Every other feature is hidden from that role, and the role holds no permission
for it.

## Starting state

The RBAC API landed in `bekie-service@788f438`: 61 permissions, four roles
(admin/manager/staff/user), `permission:` middleware on every admin route, and
role/permission CRUD endpoints. A live smoke test of the role endpoints passed
on all counts, and `tests/Feature/Api/Admin/V1` is 24 green.

Three facts about that starting state shape this design.

**A manager cannot log in at all.** `AdminAuthService::authenticateAdmin()`
(line 21) rejects any user failing `hasRole('admin')`. Verified live: a real
`is_admin`, active, unbanned user holding the manager role's permissions gets
`401 Invalid admin credentials`. Every `permission:` check behind that gate is
therefore unreachable for non-admin roles. The test suite misses it because its
helpers mint tokens with `createAdminToken()` directly
(`UserManagementTest.php:30`), bypassing `authenticateAdmin()` entirely.

**The portal has no concept of permissions.** The login payload returns
`user.roles` but no permissions. `AppSidebar.vue` holds a static `sections`
array; the router guard in `router/index.js` checks only `isAuthenticated`. No
`can()` helper exists anywhere.

**Four of the ten requested capabilities are mock-only screens.** Products,
Categories, Orders and the profile/auth flows are wired to the API. Slides
(`src/data/slides.js`), News (`src/data/news.js`) and Promotions
(`src/data/promotions.js`) read mock data despite `banners.*`, `content.*` and
`promotions.*` existing on the backend. "Manage Content in website" has no view
at all.

## Decisions

| Question | Decision |
| --- | --- |
| What is "Manage Approval"? | **Approve/reject only.** Orders list is read-only; a new `orders.approve` permission splits out of `orders.update`. |
| What is "reset password"? | **Same as change password.** No forgot-password flow is built; none exists today. |
| How does the frontend know what to hide? | **Permissions from the API.** Backend adds `permissions` to the login and `/auth/me` payload; the portal gates on permission strings. |
| The four mock-only screens | **Gate now, wire separately.** Manager is granted all ten capabilities; Slides/News/Promotions keep showing mock data until a follow-up project wires them. |
| Does "Manage" include delete? | **No.** View/create/update only. Delete stays admin-only on every resource. |
| Backend changes | **Implemented directly** in `bekie-service`, not handed over as a document (authorized 2026-08-21). |

Deliberately out of scope: wiring Slides/News/Promotions to their endpoints,
building a Content screen, a forgot-password flow, and any change to the
`staff` or `user` role grants.

## The manager permission set

22 permissions, down from 36.

| Capability | Permissions |
| --- | --- |
| Login | none — the endpoint is public |
| Logout | `admin.auth.logout` |
| Update account info, change/reset password | `admin.profile.view`, `admin.profile.update` |
| Manage Approval | `orders.view`, `orders.approve` *(new)* |
| Manage Product | `products.view`, `products.create`, `products.update` |
| Manage product category | `categories.view`, `categories.create`, `categories.update` |
| Manage Slide | `banners.view`, `banners.create`, `banners.update` |
| Manage News, Manage Content in website | `content.view`, `content.create`, `content.update` |
| Manage Promotion | `promotions.view`, `promotions.create`, `promotions.update` |
| Supporting: image upload | `media.view`, `media.create` |

Two mappings worth stating explicitly. News and Content share one permission
set — News is `content` filtered by `type`, and the backend has no separate news
permission. Image upload is unavoidable support for products, slides and news;
the portal only ever POSTs to `/admin/media` and never DELETEs, so `media.delete`
stays out.

Revoked from manager (15): `users.view`, `users.create`, `users.update`,
`roles.view`, `permissions.view`, `brands.view`, `brands.create`,
`brands.update`, `customers.view`, `orders.create`, `orders.update`,
`logs.view`, `media.delete`, `stock.view`, `stock.update`.

## What a manager sees

```
Dashboard    Overview
E-Commerce   Orders  Products  Categories  Promotions
Content      Slides  News
```

Stock Management and Reports disappear from E-Commerce. The entire Users group
(Customers, Administrators, Roles & Permissions, Logs) disappears — when every
item in a section is denied, the section header goes too. News is currently
commented out of the nav and comes back, gated on `content.view`.

Within a page: New and Edit appear where `*.create` / `*.update` is held, Delete
never appears. Orders is the exception — read-only rows with Approve and Reject
live, and no New/Edit/Delete.

## Backend architecture

**1. Open the login gate.** `authenticateAdmin()` drops the `hasRole('admin')`
condition and admits any `is_admin`, active, unbanned user. Authorization stays
where it belongs — the per-route `permission:` middleware, which a live test
confirmed already returns correct 403s (`Forbidden: missing permission
[roles.view]`). Nothing else in the method changes.

**2. Publish permissions in the auth payload.** The `user` array returned by
`authenticateAdmin()` and `AuthController::me()` both gain
`permissions => $user->getAllPermissions()->pluck('name')`. This is the contract
the whole frontend gate reads, so it must be present on both the login response
and `/auth/me` — the portal refreshes from `me` on reload.

**3. Split `orders.approve`.** Add it to `PERMISSIONS`, grant it to `admin` and
`manager`, and move the `orders/{order}/approve` and `orders/{order}/reject`
routes off `permission:orders.update` onto it. Order create/edit/delete keep
their existing permissions, so admin behaviour is unchanged.

**4. Rewrite `ROLE_GRANTS['manager']`** to the 22 permissions above.

**5. Revoke the 15 on existing databases.** `AdminPermissionsSeeder` is additive
by design — its own docblock says re-running "only adds missing grants; it
deliberately retains assignments added outside this seeder." Editing the manager
list therefore does **not** remove anything already granted, and a manager would
keep silent API access to Users, Stock and Logs while the nav hid them. A one-off
migration detaches exactly the 15 revoked permissions from the manager role. It
must target the manager role only and name the 15 explicitly rather than syncing
the role wholesale, so grants an operator added deliberately outside the seeder
are not collateral.

## Frontend architecture

`src/lib/permissions.js` is the single place that answers "may this user do X":
`can(perm)` and `canAny([...])` reading `user.permissions` from the auth store.
Every gate — nav, router, buttons — goes through it, so there is one behaviour to
test and one place to change.

- `stores/auth.js` — persist `user.permissions` alongside the tokens; expose a
  `permissions` computed and `can()`. Because the store already persists to
  `localStorage`, a stale permission list survives a reload; refreshing from
  `/auth/me` on app boot keeps it honest.
- `router/index.js` — each protected route declares `meta.permission`; the
  existing `beforeEach` gains a permission check after its auth check, so typing
  `/roles` directly is refused, not just hidden.
- `components/AppSidebar.vue` — each nav item declares `permission`; sections
  filter their items, then empty sections drop out.
- Views — gate the New/Edit/Delete controls on the matching permission.
- A "not authorized" destination for a denied direct navigation.

One incidental fix: `ProductsView.vue:245-248` fetches the catalog total and
`/admin/stock/alerts` under one `Promise.all`. A manager has no `stock.view`, so
that 403 currently rejects the pair and blanks the catalog total too.
`Promise.allSettled` keeps the total working and leaves only the stock cards at
`—`, which is what the surrounding comment already promises.

## Error handling

A 403 from the API is the backstop, not the primary mechanism — the UI should not
offer an action the user cannot perform. Where a permitted page makes a
supporting call the role lacks (the stock-alerts case above), the widget degrades
to `—` rather than failing the page. A denied route navigation redirects rather
than rendering an empty shell.

## Testing

Backend (Pest, `tests/Feature/Api/Admin/V1/`):

- a manager-role user can log in and receives `permissions` in the payload —
  this is the regression test the current suite lacks, and it must fail before
  the gate fix
- `/auth/me` returns the same permission list
- manager gets 200 on products/categories index, create, update
- manager gets 403 on users, roles, permissions, stock, logs, brands, customers
- manager gets 200 on order approve/reject, 403 on order create/update/delete
- manager gets 403 on every `*.delete` route in their own sections
- the revocation migration leaves the manager role holding exactly the 22

Frontend (Vitest):

- `can()` / `canAny()` against a manager permission list, including the empty and
  missing cases
- nav filtering produces the section list above for a manager, and the full list
  for an admin
- a section whose every item is denied is omitted entirely

## Known issues this does not fix

`GET /admin/dashboard` does not exist, so `HomeView` always falls back to its
sample figures for every role. Overview is left ungated as the post-login landing
page; it shows the same sample data it shows today.
