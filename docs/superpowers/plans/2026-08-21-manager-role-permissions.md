# Manager Role Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the `manager` role to exactly ten capabilities, and make the portal hide — and the API refuse — everything else.

**Architecture:** The backend becomes the single source of truth: it opens the login gate so non-admin roles can authenticate at all, publishes each user's flattened permission list in the auth payload, and holds the manager grant list. The portal reads that list through one pure module (`src/lib/permissions.js`) that the nav, the router guard and in-view buttons all consult, so there is one behaviour to test and one place to change.

**Tech Stack:** Backend — PHP 8.4, Laravel, Spatie laravel-permission, Pest. Frontend — Vue 3 (`<script setup>`), Pinia, vue-router, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-manager-role-permissions-design.md`

## Global Constraints

- Two repositories. Backend: `c:\Users\U-ser\Documents\SARANA-08-TEAM\bekie-service`. Frontend: `c:\Users\U-ser\Documents\SARANA-08-TEAM\BackieDealFrontEnd`. Every path below is relative to the repo named in the task's **Files** block.
- PHP is not on the default PATH. Prefix backend shell work with `export PATH="$PATH:/c/tools/php84"`.
- Frontend branch is `feat/manager-role-permissions` (already created, spec committed). Create the same branch in the backend repo before Task 1.
- Every permission and role uses `guard_name = 'api'`. Never create one without it.
- Permission names are `<resource>.<action>`, lowercase, dot-separated.
- The manager permission set is exactly these 22 strings: `admin.auth.logout`, `admin.profile.view`, `admin.profile.update`, `orders.view`, `orders.approve`, `products.view`, `products.create`, `products.update`, `categories.view`, `categories.create`, `categories.update`, `banners.view`, `banners.create`, `banners.update`, `content.view`, `content.create`, `content.update`, `promotions.view`, `promotions.create`, `promotions.update`, `media.view`, `media.create`.
- The 15 revoked from manager are exactly: `users.view`, `users.create`, `users.update`, `roles.view`, `permissions.view`, `brands.view`, `brands.create`, `brands.update`, `customers.view`, `orders.create`, `orders.update`, `logs.view`, `media.delete`, `stock.view`, `stock.update`.
- Manager gets **no** `*.delete` permission on any resource. Delete stays admin-only.
- `admin` role behaviour must not change anywhere in this plan except gaining `orders.approve`.
- Commit messages end with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## Backend: bekie-service

### Task 1: Let a non-admin role authenticate

`AdminAuthService::authenticateAdmin()` rejects anyone failing `hasRole('admin')`, so a manager cannot obtain a token and every permission check behind that gate is unreachable. The existing suite misses this because its helpers call `createAdminToken()` directly, bypassing `authenticateAdmin()`.

**Files:**
- Create: `tests/Feature/Api/Admin/V1/ManagerAuthTest.php`
- Modify: `app/Services/AdminAuthService.php:21`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `AdminAuthService::authenticateAdmin(string $email, string $password): ?array` — unchanged signature, now admitting any `is_admin` + `is_active` + `!is_banned` user whose password matches.

- [ ] **Step 1: Create the backend branch**

```bash
cd /c/Users/U-ser/Documents/SARANA-08-TEAM/bekie-service
git checkout -b feat/manager-role-permissions
```

- [ ] **Step 2: Write the failing test**

Create `tests/Feature/Api/Admin/V1/ManagerAuthTest.php`.

The `auth-admin` rate limiter allows only 5 login POSTs per minute per IP (`AppServiceProvider.php:101`), and `CACHE_STORE=array` persists hit counts across tests in one process. Login tests must disable the throttle middleware or they will flake with 429s.

```php
<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(AdminPermissionsSeeder::class);
    // auth-admin allows 5 logins/minute/IP and the array cache keeps its
    // counters across tests in one process. Without this, later tests 429.
    $this->withoutMiddleware(ThrottleRequests::class);
});

function managerUser(): User
{
    $user = User::factory()->create([
        'email' => 'manager@example.com',
        'password' => Hash::make('password'),
        'is_admin' => true,
        'is_active' => true,
        'is_banned' => false,
    ]);

    $user->syncRoles(['manager']);

    return $user;
}

test('a manager-role admin can log in', function (): void {
    managerUser();

    $response = $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'manager@example.com',
        'password' => 'password',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.user.email', 'manager@example.com')
        ->assertJsonPath('data.user.roles.0', 'manager');
});

test('a banned admin still cannot log in', function (): void {
    $user = managerUser();
    $user->is_banned = true;
    $user->save();

    $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'manager@example.com',
        'password' => 'password',
    ])->assertStatus(401);
});

test('a non-admin user cannot log in to the admin panel', function (): void {
    $user = managerUser();
    $user->is_admin = false;
    $user->save();

    $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'manager@example.com',
        'password' => 'password',
    ])->assertStatus(401);
});

test('a wrong password is rejected', function (): void {
    managerUser();

    $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'manager@example.com',
        'password' => 'wrong-password',
    ])->assertStatus(401);
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
export PATH="$PATH:/c/tools/php84"
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerAuthTest.php
```

Expected: `a manager-role admin can log in` FAILS — got 401, expected 200. The other three PASS already.

- [ ] **Step 4: Open the gate**

In `app/Services/AdminAuthService.php`, replace line 21:

```php
        if (! $user || ! Hash::check($password, $user->password) || ! $user->hasRole('admin')) {
```

with:

```php
        // Authentication only proves who this is and that they belong in the
        // admin panel at all. What they may then *do* is decided per-route by
        // the `permission:` middleware — requiring the `admin` role here made
        // every other role's grants unreachable.
        if (! $user || ! Hash::check($password, $user->password)) {
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerAuthTest.php
```

Expected: 4 passed.

- [ ] **Step 6: Run the whole suite to confirm nothing regressed**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1
```

Expected: 28 passed (24 existing + 4 new).

- [ ] **Step 7: Commit**

```bash
git add app/Services/AdminAuthService.php tests/Feature/Api/Admin/V1/ManagerAuthTest.php
git commit -m "$(cat <<'MSG'
fix(auth): admit non-admin roles to the admin panel

authenticateAdmin() required hasRole('admin'), so manager and staff could
never obtain a token and every permission: check behind that gate was dead
code for them. Authorization belongs to the per-route middleware, which
already returns correct 403s.

The existing suite missed this because its helpers mint tokens with
createAdminToken() directly, bypassing authenticateAdmin() entirely.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Publish each user's permissions in the auth payload

The portal has no way to know what it may show. Both the login response and `/auth/me` must carry the flattened permission-name list.

**Files:**
- Modify: `app/Services/AdminAuthService.php:27-38` (the returned `user` array)
- Modify: `app/Http/Controllers/Api/Admin/V1/AuthController.php:19-30` (`profilePayload`)
- Modify: `tests/Feature/Api/Admin/V1/ManagerAuthTest.php`

**Interfaces:**
- Consumes: Task 1's open login gate.
- Produces: both `POST /api/v1/admin/auth/login` (`data.user.permissions`) and `GET /api/v1/admin/auth/me` (`data.permissions`) return a JSON array of permission-name strings. Frontend Tasks 7–11 depend on these two paths.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Api/Admin/V1/ManagerAuthTest.php`:

```php
test('login returns the flattened permission list', function (): void {
    managerUser();

    $response = $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'manager@example.com',
        'password' => 'password',
    ]);

    $response->assertOk();
    $permissions = $response->json('data.user.permissions');

    expect($permissions)->toBeArray();
    expect($permissions)->toContain('products.view');
    expect($permissions)->not->toContain('roles.view');
});

test('auth/me returns the same permission list as login', function (): void {
    managerUser();

    $login = $this->postJson('/api/v1/admin/auth/login', [
        'email' => 'manager@example.com',
        'password' => 'password',
    ])->assertOk();

    $token = $login->json('data.access_token');

    $me = $this->withHeaders(['Authorization' => 'Bearer '.$token])
        ->getJson('/api/v1/admin/auth/me')
        ->assertOk();

    expect($me->json('data.permissions'))
        ->toEqualCanonicalizing($login->json('data.user.permissions'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerAuthTest.php
```

Expected: both new tests FAIL — `data.user.permissions` and `data.permissions` are null.

- [ ] **Step 3: Add permissions to the login payload**

In `app/Services/AdminAuthService.php`, in the `user` array returned by `authenticateAdmin()`, add a `permissions` key after `roles`:

```php
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'roles' => $user->getRoleNames(),
                // Flattened role + direct grants. This is the contract the
                // admin portal gates its nav, routes and buttons on.
                'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            ],
```

- [ ] **Step 4: Add permissions to the profile payload**

In `app/Http/Controllers/Api/Admin/V1/AuthController.php`, in `profilePayload()`, add the same key after `roles`:

```php
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerAuthTest.php
```

Expected: 6 passed.

- [ ] **Step 6: Confirm it live against the real database**

```bash
php artisan serve --port=8123 &
curl -s -X POST http://127.0.0.1:8123/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' \
  | python -c "import json,sys; d=json.load(sys.stdin); print(len(d['data']['user']['permissions']), 'permissions')"
```

Expected: `56 permissions` for the seeded admin.

- [ ] **Step 7: Commit**

```bash
git add app/Services/AdminAuthService.php app/Http/Controllers/Api/Admin/V1/AuthController.php tests/Feature/Api/Admin/V1/ManagerAuthTest.php
git commit -m "$(cat <<'MSG'
feat(auth): return the caller's permission list on login and me

The admin portal has to know what it may show. Both endpoints now carry
getAllPermissions()->pluck('name'), the flattened role + direct grants,
which is what the portal gates its nav, router and action buttons on.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Split `orders.approve` out of `orders.update`

"Manage Approval" means approve/reject without the ability to create, edit or delete orders. Today both approval routes sit behind `orders.update`, so granting approval would grant editing.

**Files:**
- Modify: `database/seeders/AdminPermissionsSeeder.php` (`PERMISSIONS`, and the `admin` entry in `ROLE_GRANTS`)
- Modify: `routes/api_admin.php` (the `permission:orders.update` group)
- Create: `tests/Feature/Api/Admin/V1/OrderApprovalPermissionTest.php`

**Interfaces:**
- Consumes: Task 1 and Task 2.
- Produces: the permission string `orders.approve`, guarding `POST orders/{order}/approve` and `POST orders/{order}/reject`. Task 4 grants it to manager; Task 6 asserts the boundary.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Api/Admin/V1/OrderApprovalPermissionTest.php`.

**Why these are structural rather than HTTP tests.** `SubstituteBindings` sits in the `api` middleware group, which runs *before* route middleware. `Order` binds by `uuid` (`Order.php:62`). So a request to `orders/{order}/approve` for a nonexistent order resolves the binding and 404s before `permission:` is ever consulted — verified live against the running API. An HTTP test therefore cannot tell "guard refused me" from "record missing" without real order fixtures, and there is no `OrderFactory`. Asserting the route's gathered middleware tests the mapping directly and needs no fixtures.

```php
<?php

declare(strict_types=1);

use App\Models\Permission;
use App\Models\Role;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(AdminPermissionsSeeder::class);
});

/**
 * The middleware stack Laravel will actually run for a registered route.
 *
 * @return list<string>
 */
function middlewareFor(string $uri, string $method): array
{
    $route = collect(Route::getRoutes()->getRoutes())
        ->first(fn ($route): bool => $route->uri() === $uri
            && in_array($method, $route->methods(), true));

    expect($route)->not->toBeNull("route {$method} {$uri} is not registered");

    return $route->gatherMiddleware();
}

test('orders.approve exists as a permission', function (): void {
    expect(Permission::where('name', 'orders.approve')->where('guard_name', 'api')->exists())
        ->toBeTrue();
});

test('the approve route is guarded by orders.approve, not orders.update', function (): void {
    $middleware = middlewareFor('api/v1/admin/orders/{order}/approve', 'POST');

    expect($middleware)->toContain('permission:orders.approve');
    expect($middleware)->not->toContain('permission:orders.update');
});

test('the reject route is guarded by orders.approve, not orders.update', function (): void {
    $middleware = middlewareFor('api/v1/admin/orders/{order}/reject', 'POST');

    expect($middleware)->toContain('permission:orders.approve');
    expect($middleware)->not->toContain('permission:orders.update');
});

test('editing an order still requires orders.update', function (): void {
    $middleware = middlewareFor('api/v1/admin/orders/{order}', 'PATCH');

    expect($middleware)->toContain('permission:orders.update');
    expect($middleware)->not->toContain('permission:orders.approve');
});

test('the admin role holds orders.approve', function (): void {
    $admin = Role::where('name', 'admin')->where('guard_name', 'api')->firstOrFail();

    expect($admin->hasPermissionTo('orders.approve'))->toBeTrue();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/OrderApprovalPermissionTest.php
```

Expected: FAIL — `orders.approve` does not exist, so the permission lookup fails and `syncPermissions` throws `PermissionDoesNotExist`.

- [ ] **Step 3: Add the permission to the catalogue**

In `database/seeders/AdminPermissionsSeeder.php`, in the `PERMISSIONS` array, change the Orders block:

```php
        // Orders
        'orders.view',
        'orders.create',
        'orders.update',
        'orders.delete',
```

to:

```php
        // Orders
        'orders.view',
        'orders.create',
        'orders.update',
        'orders.delete',
        // Approval is deliberately separate from update: a manager approves
        // and rejects orders without being able to edit or create them.
        'orders.approve',
```

- [ ] **Step 4: Grant it to the admin role**

In the same file, in `ROLE_GRANTS['admin']`, change:

```php
            'orders.view', 'orders.create', 'orders.update', 'orders.delete',
```

to:

```php
            'orders.view', 'orders.create', 'orders.update', 'orders.delete', 'orders.approve',
```

- [ ] **Step 5: Move the approval routes onto the new permission**

In `routes/api_admin.php`, the current group is:

```php
        Route::middleware('permission:orders.update')->group(function () {
            Route::match(['put', 'patch'], 'orders/{order}', [OrderController::class, 'update']);
            Route::post('orders/{order}/approve', [OrderController::class, 'approve']);
            Route::post('orders/{order}/reject', [OrderController::class, 'reject']);
        });
```

Replace it with:

```php
        Route::middleware('permission:orders.update')->group(function () {
            Route::match(['put', 'patch'], 'orders/{order}', [OrderController::class, 'update']);
        });
        Route::middleware('permission:orders.approve')->group(function () {
            Route::post('orders/{order}/approve', [OrderController::class, 'approve']);
            Route::post('orders/{order}/reject', [OrderController::class, 'reject']);
        });
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/OrderApprovalPermissionTest.php
```

Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add database/seeders/AdminPermissionsSeeder.php routes/api_admin.php tests/Feature/Api/Admin/V1/OrderApprovalPermissionTest.php
git commit -m "$(cat <<'MSG'
feat(rbac): split orders.approve out of orders.update

Approval and editing were the same permission, so granting a manager the
ability to approve an order would also let them edit and create orders.
The approve/reject routes now sit behind orders.approve; admin gains it so
its behaviour is unchanged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Scope the manager grant list to the 22

**Files:**
- Modify: `database/seeders/AdminPermissionsSeeder.php` (`ROLE_GRANTS['manager']`, currently 36 entries)
- Create: `tests/Feature/Api/Admin/V1/ManagerGrantsTest.php`

**Interfaces:**
- Consumes: `orders.approve` from Task 3.
- Produces: `AdminPermissionsSeeder::ROLE_GRANTS['manager']` as the 22-string list. Task 5's migration and Task 6's boundary test both read it.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Api/Admin/V1/ManagerGrantsTest.php`.

```php
<?php

declare(strict_types=1);

use App\Models\Role;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const MANAGER_PERMISSIONS = [
    'admin.auth.logout',
    'admin.profile.update',
    'admin.profile.view',
    'banners.create',
    'banners.update',
    'banners.view',
    'categories.create',
    'categories.update',
    'categories.view',
    'content.create',
    'content.update',
    'content.view',
    'media.create',
    'media.view',
    'orders.approve',
    'orders.view',
    'products.create',
    'products.update',
    'products.view',
    'promotions.create',
    'promotions.update',
    'promotions.view',
];

beforeEach(function (): void {
    $this->seed(AdminPermissionsSeeder::class);
});

test('the manager role holds exactly the 22 scoped permissions', function (): void {
    $manager = Role::where('name', 'manager')->where('guard_name', 'api')->firstOrFail();

    expect($manager->permissions->pluck('name')->sort()->values()->all())
        ->toEqualCanonicalizing(MANAGER_PERMISSIONS);
});

test('the manager role holds no delete permission', function (): void {
    $manager = Role::where('name', 'manager')->where('guard_name', 'api')->firstOrFail();

    $deletes = $manager->permissions
        ->pluck('name')
        ->filter(fn (string $name): bool => str_ends_with($name, '.delete'));

    expect($deletes->all())->toBe([]);
});

test('the seeder is idempotent for the manager role', function (): void {
    $this->seed(AdminPermissionsSeeder::class);
    $this->seed(AdminPermissionsSeeder::class);

    $manager = Role::where('name', 'manager')->where('guard_name', 'api')->firstOrFail();

    expect($manager->permissions->pluck('name')->unique()->count())->toBe(22);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerGrantsTest.php
```

Expected: FAIL — manager currently holds 36 permissions, not these 22.

- [ ] **Step 3: Rewrite the manager grants**

In `database/seeders/AdminPermissionsSeeder.php`, replace the whole `'manager' => [...]` entry with:

```php
        // Scoped to the ten capabilities the requirements name: auth/profile
        // self-service, order approval, products, slides (banners), news and
        // website content, promotions, and product categories. No delete on
        // anything — that stays with admin. media.view/create are support for
        // uploading product, slide and news images; the portal never DELETEs
        // media, so media.delete is deliberately absent.
        'manager' => [
            'admin.profile.view', 'admin.profile.update', 'admin.auth.logout',
            'orders.view', 'orders.approve',
            'products.view', 'products.create', 'products.update',
            'categories.view', 'categories.create', 'categories.update',
            'banners.view', 'banners.create', 'banners.update',
            'content.view', 'content.create', 'content.update',
            'promotions.view', 'promotions.create', 'promotions.update',
            'media.view', 'media.create',
        ],
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerGrantsTest.php
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add database/seeders/AdminPermissionsSeeder.php tests/Feature/Api/Admin/V1/ManagerGrantsTest.php
git commit -m "$(cat <<'MSG'
feat(rbac): scope the manager role to its ten capabilities

Manager drops from 36 permissions to 22: auth/profile self-service, order
approval, products, slides, news, website content, promotions and product
categories, plus media upload as support. No delete on anything.

Revoked: users.*, roles.view, permissions.view, brands.*, customers.view,
orders.create/update, logs.view, media.delete, stock.*.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Revoke the 15 on already-seeded databases

`AdminPermissionsSeeder::run()` only ever calls `givePermissionTo()`. Its docblock states it "deliberately retains assignments added outside this seeder." Task 4's edit therefore removes nothing from a database that has already been seeded — a manager would keep real API access to Users, Stock and Logs while the portal merely hid them.

**Files:**
- Create: `database/migrations/2026_08_21_000000_revoke_scoped_manager_permissions.php`
- Create: `tests/Feature/Api/Admin/V1/ManagerRevocationMigrationTest.php`

**Interfaces:**
- Consumes: Task 4's grant list.
- Produces: nothing other tasks call. The migration is idempotent and safe to re-run.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Api/Admin/V1/ManagerRevocationMigrationTest.php`.

`RefreshDatabase` runs migrations before the test body, so the migration has already been applied. The test re-grants the old permissions to simulate a legacy database, then runs the migration again — which also proves it is idempotent.

```php
<?php

declare(strict_types=1);

use App\Models\Role;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Spatie\Permission\PermissionRegistrar;

uses(RefreshDatabase::class);

const LEGACY_MANAGER_EXTRAS = [
    'users.view', 'users.create', 'users.update',
    'roles.view',
    'permissions.view',
    'brands.view', 'brands.create', 'brands.update',
    'customers.view',
    'orders.create', 'orders.update',
    'logs.view',
    'media.delete',
    'stock.view', 'stock.update',
];

beforeEach(function (): void {
    $this->seed(AdminPermissionsSeeder::class);
});

test('the migration strips the legacy manager grants', function (): void {
    $manager = Role::where('name', 'manager')->where('guard_name', 'api')->firstOrFail();

    // Simulate a database seeded before the role was scoped.
    foreach (LEGACY_MANAGER_EXTRAS as $permission) {
        $manager->givePermissionTo($permission);
    }
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    expect($manager->fresh()->permissions)->toHaveCount(37);

    Artisan::call('migrate', ['--path' => 'database/migrations/2026_08_21_000000_revoke_scoped_manager_permissions.php', '--force' => true]);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    expect($manager->fresh()->permissions)->toHaveCount(22);
});

test('the migration leaves other roles untouched', function (): void {
    $adminBefore = Role::where('name', 'admin')->where('guard_name', 'api')->firstOrFail()
        ->permissions->pluck('name')->sort()->values()->all();
    $staffBefore = Role::where('name', 'staff')->where('guard_name', 'api')->firstOrFail()
        ->permissions->pluck('name')->sort()->values()->all();

    Artisan::call('migrate', ['--path' => 'database/migrations/2026_08_21_000000_revoke_scoped_manager_permissions.php', '--force' => true]);
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    expect(Role::where('name', 'admin')->where('guard_name', 'api')->firstOrFail()
        ->permissions->pluck('name')->sort()->values()->all())->toBe($adminBefore);
    expect(Role::where('name', 'staff')->where('guard_name', 'api')->firstOrFail()
        ->permissions->pluck('name')->sort()->values()->all())->toBe($staffBefore);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerRevocationMigrationTest.php
```

Expected: FAIL — the migration file does not exist, so `migrate --path` finds nothing and the manager keeps 37 permissions.

- [ ] **Step 3: Write the migration**

Create `database/migrations/2026_08_21_000000_revoke_scoped_manager_permissions.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Permissions the manager role held before it was scoped to the ten
     * capabilities the requirements name. AdminPermissionsSeeder only ever adds
     * grants — its docblock says it "deliberately retains assignments added
     * outside this seeder" — so editing ROLE_GRANTS cannot take these away on a
     * database that has already been seeded. Without this migration a manager
     * keeps real API access to Users, Stock and Logs while the portal hides them.
     *
     * @var list<string>
     */
    private const REVOKED = [
        'users.view', 'users.create', 'users.update',
        'roles.view',
        'permissions.view',
        'brands.view', 'brands.create', 'brands.update',
        'customers.view',
        'orders.create', 'orders.update',
        'logs.view',
        'media.delete',
        'stock.view', 'stock.update',
    ];

    public function up(): void
    {
        $roleId = DB::table('roles')
            ->where('name', 'manager')
            ->where('guard_name', 'api')
            ->value('id');

        if ($roleId === null) {
            return;
        }

        // Named explicitly rather than syncing the role wholesale, so a grant
        // an operator added on purpose outside the seeder is not collateral.
        $permissionIds = DB::table('permissions')
            ->where('guard_name', 'api')
            ->whereIn('name', self::REVOKED)
            ->pluck('id');

        if ($permissionIds->isEmpty()) {
            return;
        }

        DB::table('role_has_permissions')
            ->where('role_id', $roleId)
            ->whereIn('permission_id', $permissionIds)
            ->delete();

        // Spatie caches the permission map; without this the old grants keep
        // answering hasPermissionTo() until the cache expires.
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        // Re-granting on rollback would hand the manager role back exactly the
        // access this migration exists to remove. To restore it deliberately,
        // add the permissions to ROLE_GRANTS['manager'] and re-run the seeder.
    }
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerRevocationMigrationTest.php
```

Expected: 2 passed.

- [ ] **Step 5: Apply it to the local development database**

```bash
php artisan migrate
php artisan tinker --execute='
$m = \App\Models\Role::where("name","manager")->where("guard_name","api")->firstOrFail();
echo "manager permissions: ".$m->permissions->count().PHP_EOL;
echo $m->permissions->pluck("name")->sort()->implode(", ").PHP_EOL;
'
```

Expected: `manager permissions: 22`, listing exactly the 22 from Global Constraints. If it reports more, the seeder has not been re-run since Task 4 — run `php artisan db:seed --class=AdminPermissionsSeeder` first, then re-check.

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_08_21_000000_revoke_scoped_manager_permissions.php tests/Feature/Api/Admin/V1/ManagerRevocationMigrationTest.php
git commit -m "$(cat <<'MSG'
feat(rbac): revoke the manager role's out-of-scope grants

AdminPermissionsSeeder is additive by design, so scoping ROLE_GRANTS in the
previous commit removed nothing from databases already seeded. Managers
would have kept real API access to Users, Stock and Logs while the portal
hid them.

Names the 15 revoked permissions explicitly rather than syncing the role
wholesale, so deliberate out-of-band grants are not collateral, and flushes
Spatie's permission cache so the change takes effect immediately.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 6: Pin the manager authorization boundary

One test that asserts, endpoint by endpoint, what a manager may and may not reach. This is the regression net for the whole feature.

**Files:**
- Create: `tests/Feature/Api/Admin/V1/ManagerBoundaryTest.php`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: nothing other tasks call.

- [ ] **Step 1: Write the test**

Create `tests/Feature/Api/Admin/V1/ManagerBoundaryTest.php`.

Two constraints shape this test, both verified live against the running API:

- **Collection routes only in the datasets.** `SubstituteBindings` runs in the `api` group, before route middleware, so any route with a `{model}` parameter 404s on a missing record *before* `permission:` is consulted. Routes without bindings give a clean 403, so the datasets use only those. The two delete cases below use real factory records so the binding resolves and the guard is what answers.
- **`Product` binds by `uuid`** (`Product.php:81`), so a delete URL must use `$product->getRouteKey()`, not the id. `Category` has no override and binds by id.

```php
<?php

declare(strict_types=1);

use App\Models\Category;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Services\AdminAuthService;
use Database\Seeders\AdminPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(AdminPermissionsSeeder::class);

    $user = User::factory()->create(['is_admin' => true]);
    $user->syncRoles(['manager']);

    app()->instance('request', Request::create('/admin/auth/login', 'POST'));
    $this->managerToken = (new AdminAuthService)->createAdminToken($user)['access_token'];
});

dataset('denied to manager', [
    'users list' => ['get', '/api/v1/admin/users'],
    'user create' => ['post', '/api/v1/admin/users'],
    'roles list' => ['get', '/api/v1/admin/roles'],
    'role create' => ['post', '/api/v1/admin/roles'],
    'permissions list' => ['get', '/api/v1/admin/permissions'],
    'permission create' => ['post', '/api/v1/admin/permissions'],
    'brands list' => ['get', '/api/v1/admin/brands'],
    'customers list' => ['get', '/api/v1/admin/customers'],
    'administrators list' => ['get', '/api/v1/admin/administrators'],
    'stock list' => ['get', '/api/v1/admin/stock'],
    'stock alerts' => ['get', '/api/v1/admin/stock/alerts'],
    'stock movements' => ['get', '/api/v1/admin/stock/movements'],
    'activity logs' => ['get', '/api/v1/admin/activity-logs'],
    'team logs' => ['get', '/api/v1/admin/logs/team'],
    'visitor logs' => ['get', '/api/v1/admin/logs/visitors'],
    'sold products report' => ['get', '/api/v1/admin/reports/sold-products'],
    'order create' => ['post', '/api/v1/admin/orders'],
]);

test('manager is refused', function (string $method, string $uri): void {
    $this->withHeaders(['Authorization' => 'Bearer '.$this->managerToken])
        ->json(strtoupper($method), $uri)
        ->assertStatus(403);
})->with('denied to manager');

dataset('allowed to manager', [
    'products list' => ['get', '/api/v1/admin/products'],
    'categories list' => ['get', '/api/v1/admin/categories'],
    'orders list' => ['get', '/api/v1/admin/orders'],
    'promotions list' => ['get', '/api/v1/admin/promotions'],
    'banners list' => ['get', '/api/v1/admin/banners'],
    'content list' => ['get', '/api/v1/admin/content'],
    'media list' => ['get', '/api/v1/admin/media'],
    'own profile' => ['get', '/api/v1/admin/auth/me'],
]);

// A permitted route may answer 200, 404 or 422 depending on fixtures. What
// matters is only that the permission gate did not refuse it.
test('manager is not refused', function (string $method, string $uri): void {
    $response = $this->withHeaders(['Authorization' => 'Bearer '.$this->managerToken])
        ->json(strtoupper($method), $uri);

    expect($response->status())->not->toBe(403);
})->with('allowed to manager');

test('manager cannot delete a product that exists', function (): void {
    $product = Product::factory()->create();

    $this->withHeaders(['Authorization' => 'Bearer '.$this->managerToken])
        ->deleteJson('/api/v1/admin/products/'.$product->getRouteKey())
        ->assertStatus(403);

    expect($product->fresh())->not->toBeNull();
});

test('manager cannot delete a category that exists', function (): void {
    $category = Category::factory()->create();

    $this->withHeaders(['Authorization' => 'Bearer '.$this->managerToken])
        ->deleteJson('/api/v1/admin/categories/'.$category->getRouteKey())
        ->assertStatus(403);

    expect($category->fresh())->not->toBeNull();
});

// Covers the banner/content/promotion/order deletes without needing fixtures
// for models that have no factory: the role simply holds no delete grant, and
// every destroy route is guarded by `<resource>.delete`.
test('manager holds no delete grant at all', function (): void {
    $manager = Role::where('name', 'manager')->where('guard_name', 'api')->firstOrFail();

    $deletes = $manager->permissions
        ->pluck('name')
        ->filter(fn (string $name): bool => str_ends_with($name, '.delete'));

    expect($deletes->all())->toBe([]);
});

test('manager may approve orders but not edit them', function (): void {
    $manager = Role::where('name', 'manager')->where('guard_name', 'api')->firstOrFail();

    expect($manager->hasPermissionTo('orders.approve'))->toBeTrue();
    expect($manager->hasPermissionTo('orders.update'))->toBeFalse();
    expect($manager->hasPermissionTo('orders.create'))->toBeFalse();
});
```

- [ ] **Step 2: Run the test**

```bash
php vendor/bin/pest tests/Feature/Api/Admin/V1/ManagerBoundaryTest.php
```

Expected: 29 passed (17 denied + 8 allowed + 4 standalone). If a "manager is refused" case returns 200, that permission is still granted — recheck Tasks 4 and 5. If a "manager is not refused" case returns 403, the grant is missing from Task 4's list. If any case returns 404 where a 403 was expected, the route has a `{model}` binding and does not belong in a dataset — give it a factory record instead, as the two delete tests do.

- [ ] **Step 3: Run the full backend suite**

```bash
php vendor/bin/pest
```

Expected: all green. Record the count.

- [ ] **Step 4: Commit**

```bash
git add tests/Feature/Api/Admin/V1/ManagerBoundaryTest.php
git commit -m "$(cat <<'MSG'
test(rbac): pin the manager authorization boundary

Asserts endpoint by endpoint what a manager may and may not reach: refused
on users, roles, permissions, brands, customers, administrators, stock,
logs, reports and every delete; allowed on products, categories, orders,
promotions, banners, content, media, own profile and order approval.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

## Frontend: BackieDealFrontEnd

### Task 7: The permission module and store wiring

One pure module answers "may this user do X". Keeping it free of Pinia and vue-router makes it directly unit-testable; the store wraps it with the current user's list.

**Files:**
- Create: `src/lib/permissions.js`
- Create: `src/lib/permissions.spec.js`
- Modify: `src/stores/auth.js`

**Interfaces:**
- Consumes: `data.user.permissions` from backend Task 2.
- Produces:
  - `can(permissions: string[] | undefined, permission: string | null): boolean`
  - `canAny(permissions: string[] | undefined, required: string[]): boolean`
  - auth store gains `permissions` (computed `string[]`), `hasPermission(permission: string | null): boolean`, `hasAnyPermission(required: string[]): boolean`, and `refreshProfile(): Promise<void>`.
  - Tasks 8–12 all consume `auth.hasPermission`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/permissions.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import { can, canAny } from '@/lib/permissions'

const MANAGER = ['products.view', 'products.create', 'orders.view', 'orders.approve']

describe('can', () => {
  it('grants a permission the user holds', () => {
    expect(can(MANAGER, 'products.view')).toBe(true)
  })

  it('denies a permission the user does not hold', () => {
    expect(can(MANAGER, 'roles.view')).toBe(false)
  })

  it('treats a null permission as unrestricted', () => {
    expect(can(MANAGER, null)).toBe(true)
    expect(can([], undefined)).toBe(true)
  })

  // Fail closed: a session persisted before the API sent permissions has no
  // list at all, and must not be read as unrestricted access.
  it('denies everything when the list is missing', () => {
    expect(can(undefined, 'products.view')).toBe(false)
    expect(can(null, 'products.view')).toBe(false)
  })

  it('denies everything when the list is empty', () => {
    expect(can([], 'products.view')).toBe(false)
  })
})

describe('canAny', () => {
  it('grants when one of the required permissions is held', () => {
    expect(canAny(MANAGER, ['roles.view', 'products.view'])).toBe(true)
  })

  it('denies when none are held', () => {
    expect(canAny(MANAGER, ['roles.view', 'logs.view'])).toBe(false)
  })

  it('treats an empty requirement list as unrestricted', () => {
    expect(canAny(MANAGER, [])).toBe(true)
  })

  it('denies when the list is missing', () => {
    expect(canAny(undefined, ['products.view'])).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd /c/Users/U-ser/Documents/SARANA-08-TEAM/BackieDealFrontEnd
npm run test:run -- src/lib/permissions.spec.js
```

Expected: FAIL — cannot resolve `@/lib/permissions`.

- [ ] **Step 3: Write the module**

Create `src/lib/permissions.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:run -- src/lib/permissions.spec.js
```

Expected: 9 passed.

- [ ] **Step 5: Wire the store**

In `src/stores/auth.js`, add the import at the top, alongside the existing imports:

```js
import { can, canAny } from '@/lib/permissions'
```

After the `isAuthenticated` computed, add:

```js
  // `permissions` rides inside `user`, so the existing persist() already
  // carries it through a reload. It can go stale between reloads, which is
  // why App.vue refreshes from /auth/me on boot.
  const permissions = computed(() => user.value?.permissions ?? [])

  function hasPermission(permission) {
    return can(permissions.value, permission)
  }

  function hasAnyPermission(required) {
    return canAny(permissions.value, required)
  }
```

After the `logout` function, add:

```js
  // GET /admin/auth/me -> { data: { ...profile, permissions } }
  // Re-reads the profile so a grant changed server-side takes effect on the
  // next page load rather than lingering in localStorage.
  async function refreshProfile() {
    if (!accessToken.value) return
    try {
      const response = await apiFetch('/admin/auth/me', { token: accessToken.value })
      if (response?.data) setUser(response.data)
    } catch {
      // A failure here leaves the persisted user in place; the router guard
      // and API 403s still hold the line.
    }
  }
```

Finally add the four new names to the returned object, after `setUser`:

```js
    setUser,
    permissions,
    hasPermission,
    hasAnyPermission,
    refreshProfile,
```

- [ ] **Step 6: Verify the store still passes its own tests and lints**

```bash
npm run test:run
npm run lint
```

Expected: all tests pass, no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/permissions.js src/lib/permissions.spec.js src/stores/auth.js
git commit -m "$(cat <<'MSG'
feat(auth): add the permission module and store accessors

can()/canAny() are pure and take the permission list as an argument, so they
unit test without Pinia or vue-router. The auth store wraps them with the
signed-in user's list and gains refreshProfile() to re-read /auth/me.

A missing list denies everything: a session persisted before the API carried
permissions must not read as full access.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 8: Refresh permissions on app boot

A persisted session carries whatever permissions it had when it was stored. Re-reading `/auth/me` on boot means a grant changed server-side takes effect on the next page load.

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `auth.refreshProfile()` from Task 7.
- Produces: nothing other tasks call.

- [ ] **Step 1: Add the boot refresh**

In `src/App.vue`, change the `<script setup>` block from:

```js
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const ui = useUiStore()
```

to:

```js
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const ui = useUiStore()
const auth = useAuthStore()

// The persisted session carries whatever permissions it held when it was
// stored. Re-reading the profile on boot means a grant changed server-side
// takes effect on the next page load instead of lingering in localStorage.
onMounted(() => {
  if (auth.isAuthenticated) auth.refreshProfile()
})
```

- [ ] **Step 2: Verify by hand**

Start both servers, sign in as `admin@example.com` / `password`, then in the browser console confirm the persisted session carries permissions:

```bash
npm run dev
```

In the browser console:

```js
JSON.parse(localStorage.getItem('beckie_admin_auth')).user.permissions.length
```

Expected: `56` for the seeded admin.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "$(cat <<'MSG'
feat(auth): refresh the profile on app boot

A persisted session carries the permissions it held when it was stored.
Re-reading /auth/me on mount means a grant changed server-side applies on
the next page load rather than waiting for a fresh sign-in.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 9: Gate the router

Hiding a nav item is not access control — typing `/roles` must be refused too. The decision is extracted into a pure function so it can be unit tested without mounting a router.

**Files:**
- Create: `src/router/guards.js`
- Create: `src/router/guards.spec.js`
- Create: `src/views/ForbiddenView.vue`
- Modify: `src/router/index.js`

**Interfaces:**
- Consumes: `auth.hasPermission` from Task 7.
- Produces: `resolveAccess(to: RouteLocation, { isAuthenticated: boolean, hasPermission: (p: string|null) => boolean }): { name: string, query?: object } | null` — returns a redirect target, or `null` to allow. Task 10 reuses none of it; nothing else depends on it.

- [ ] **Step 1: Write the failing test**

Create `src/router/guards.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import { resolveAccess } from '@/router/guards'

const MANAGER = ['products.view', 'orders.view', 'admin.profile.view']

function ctx(isAuthenticated, permissions = MANAGER) {
  return {
    isAuthenticated,
    hasPermission: (permission) => !permission || permissions.includes(permission),
  }
}

const route = (name, meta = {}) => ({ name, meta, fullPath: `/${name}` })

describe('resolveAccess', () => {
  it('sends an anonymous visitor to login with a redirect', () => {
    expect(resolveAccess(route('products', { permission: 'products.view' }), ctx(false)))
      .toEqual({ name: 'login', query: { redirect: '/products' } })
  })

  it('lets an anonymous visitor reach a public route', () => {
    expect(resolveAccess(route('login', { public: true, layout: 'blank' }), ctx(false)))
      .toBeNull()
  })

  it('sends a signed-in user away from login', () => {
    expect(resolveAccess(route('login', { public: true }), ctx(true)))
      .toEqual({ name: 'home' })
  })

  it('allows a route whose permission the user holds', () => {
    expect(resolveAccess(route('products', { permission: 'products.view' }), ctx(true)))
      .toBeNull()
  })

  it('refuses a route whose permission the user lacks', () => {
    expect(resolveAccess(route('roles', { permission: 'roles.view' }), ctx(true)))
      .toEqual({ name: 'forbidden' })
  })

  it('allows a route that declares no permission', () => {
    expect(resolveAccess(route('home'), ctx(true))).toBeNull()
  })

  // Authentication is checked before permission, so an expired session lands
  // on login rather than on a misleading "forbidden" page.
  it('prefers login over forbidden for an anonymous visitor', () => {
    expect(resolveAccess(route('roles', { permission: 'roles.view' }), ctx(false)))
      .toEqual({ name: 'login', query: { redirect: '/roles' } })
  })

  it('never refuses the forbidden page itself', () => {
    expect(resolveAccess(route('forbidden'), ctx(true))).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run -- src/router/guards.spec.js
```

Expected: FAIL — cannot resolve `@/router/guards`.

- [ ] **Step 3: Write the guard**

Create `src/router/guards.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:run -- src/router/guards.spec.js
```

Expected: 8 passed.

- [ ] **Step 5: Create the forbidden view**

Create `src/views/ForbiddenView.vue`:

```vue
<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="forbidden">
    <p class="forbidden__code">403</p>
    <h1 class="forbidden__title">You don't have access to this page</h1>
    <p class="forbidden__body">
      Your role doesn't include this section. If you need it, ask an
      administrator to update your permissions.
    </p>
    <RouterLink to="/" class="forbidden__link">Back to Overview</RouterLink>
  </div>
</template>

<style scoped lang="scss">
.forbidden {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  max-width: 32rem;
  padding: 64px 32px;

  &__code {
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  &__title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text);
  }

  &__body {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.6;
  }

  &__link {
    margin-top: 8px;
    font-weight: 600;
    color: var(--brand);
  }
}
</style>
```

- [ ] **Step 6: Declare permissions on every route**

In `src/router/index.js`, add `meta: { permission: '<name>' }` to each route below, merging with any existing `meta`. Add the `forbidden` route, and replace the guard.

Route-to-permission mapping — apply exactly:

| Route name | `meta.permission` |
| --- | --- |
| `home` | *(none — post-login landing page)* |
| `orders`, `order-detail` | `orders.view` |
| `order-create` | `orders.create` |
| `products` | `products.view` |
| `product-create` | `products.create` |
| `product-edit` | `products.update` |
| `categories`, `category-detail` | `categories.view` |
| `category-create` | `categories.create` |
| `customers`, `customer-detail` | `customers.view` |
| `customer-create` | `users.create` |
| `customer-edit` | `users.update` |
| `promotions`, `promotion-detail` | `promotions.view` |
| `promotion-create` | `promotions.create` |
| `promotion-edit` | `promotions.update` |
| `stock`, `stock-detail` | `stock.view` |
| `stock-adjustment-create` | `stock.update` |
| `reports` | `logs.view` |
| `slides`, `slide-detail` | `banners.view` |
| `slide-create` | `banners.create` |
| `slide-edit` | `banners.update` |
| `news` | `content.view` |
| `news-create` | `content.create` |
| `news-edit` | `content.update` |
| `administrators` | `administrators.view` |
| `roles` | `roles.view` |
| `logs` | `logs.view` |
| `profile` | `admin.profile.view` |
| `login` | *(none — already `public: true`)* |
| `about` | *(none)* |
| `forbidden` | *(none)* |

The customer create/edit screens are mock-only and the backend exposes no `customers.create` / `customers.update`; a customer is a user, so they gate on `users.create` / `users.update`.

Worked example — the `orders` and `order-create` routes become:

```js
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/views/OrdersView.vue'),
      meta: { permission: 'orders.view' },
    },
    {
      path: '/orders/new',
      name: 'order-create',
      component: () => import('@/views/OrderCreateView.vue'),
      meta: { permission: 'orders.create' },
    },
```

Add the forbidden route as the last entry in `routes`, after `about`:

```js
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
    },
```

- [ ] **Step 7: Replace the guard**

In `src/router/index.js`, add to the imports at the top:

```js
import { resolveAccess } from '@/router/guards'
```

Then replace the whole existing `router.beforeEach` block:

```js
// Guard every non-public route behind admin authentication.
router.beforeEach((to) => {
  const auth = useAuthStore()

  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && auth.isAuthenticated) {
    return { name: 'home' }
  }
})
```

with:

```js
// Guard every non-public route behind admin authentication, then behind the
// permission the route declares. The decision itself lives in ./guards so it
// can be unit tested without mounting a router.
router.beforeEach((to) => {
  const auth = useAuthStore()

  return (
    resolveAccess(to, {
      isAuthenticated: auth.isAuthenticated,
      hasPermission: (permission) => auth.hasPermission(permission),
    }) ?? true
  )
})
```

- [ ] **Step 8: Verify**

```bash
npm run test:run
npm run lint
```

Expected: all pass. Then with both servers running, sign in as admin and confirm `/roles` still loads; the manager check happens in Task 10's verification once a manager account exists.

- [ ] **Step 9: Commit**

```bash
git add src/router/guards.js src/router/guards.spec.js src/views/ForbiddenView.vue src/router/index.js
git commit -m "$(cat <<'MSG'
feat(router): refuse routes the signed-in role lacks

Every protected route declares meta.permission and the guard enforces it, so
a hidden section cannot be reached by typing its URL. Authentication is
checked first, so an expired session lands on login rather than a misleading
403 page.

The decision lives in router/guards.js as a pure function taking the auth
state as an argument, so it unit tests without mounting a router.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 10: Gate the sidebar

The nav model moves out of the component into data, so the filtering rule — including dropping a section whose every item is denied — can be unit tested.

**Files:**
- Create: `src/lib/navigation.js`
- Create: `src/lib/navigation.spec.js`
- Modify: `src/components/AppSidebar.vue`

**Interfaces:**
- Consumes: `auth.hasPermission` from Task 7.
- Produces:
  - `NAV_SECTIONS: Array<{ title: string, items: Array<{ label, icon, to, permission: string|null, badge?: number }> }>`
  - `visibleSections(hasPermission: (p: string|null) => boolean): typeof NAV_SECTIONS` — items filtered, then sections with no remaining items dropped.

- [ ] **Step 1: Write the failing test**

Create `src/lib/navigation.spec.js`:

```js
import { describe, it, expect } from 'vitest'
import { NAV_SECTIONS, visibleSections } from '@/lib/navigation'

const MANAGER = [
  'admin.auth.logout',
  'admin.profile.view',
  'admin.profile.update',
  'orders.view',
  'orders.approve',
  'products.view',
  'products.create',
  'products.update',
  'categories.view',
  'categories.create',
  'categories.update',
  'banners.view',
  'banners.create',
  'banners.update',
  'content.view',
  'content.create',
  'content.update',
  'promotions.view',
  'promotions.create',
  'promotions.update',
  'media.view',
  'media.create',
]

const allow = (permissions) => (permission) => !permission || permissions.includes(permission)

function labels(sections) {
  return sections.flatMap((section) => section.items.map((item) => item.label))
}

describe('visibleSections', () => {
  it('shows a manager exactly their seven destinations', () => {
    expect(labels(visibleSections(allow(MANAGER)))).toEqual([
      'Overview',
      'Orders',
      'Products',
      'Categories',
      'Promotions',
      'Slides',
      'News',
    ])
  })

  it('drops the Users section entirely for a manager', () => {
    expect(visibleSections(allow(MANAGER)).map((s) => s.title))
      .toEqual(['Dashboard', 'E-Commerce', 'Content'])
  })

  it('hides Stock Management and Reports from a manager', () => {
    const shown = labels(visibleSections(allow(MANAGER)))
    expect(shown).not.toContain('Stock Management')
    expect(shown).not.toContain('Reports')
  })

  it('shows everything to a user holding every permission', () => {
    const every = NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.permission)).filter(Boolean)
    expect(visibleSections(allow(every))).toHaveLength(NAV_SECTIONS.length)
  })

  it('leaves only the always-visible items when nothing is permitted', () => {
    expect(labels(visibleSections(allow([])))).toEqual(['Overview'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test:run -- src/lib/navigation.spec.js
```

Expected: FAIL — cannot resolve `@/lib/navigation`.

- [ ] **Step 3: Write the navigation model**

Create `src/lib/navigation.js`:

```js
// The sidebar nav as data, so the filtering rule below can be unit tested
// without mounting the component. `icon` keys map to the inline <svg> set in
// AppSidebar.vue. `permission` is the grant required to see the item; null
// means always visible.

export const NAV_SECTIONS = [
  {
    title: 'Dashboard',
    items: [
      // The post-login landing page: every role needs somewhere to arrive.
      { label: 'Overview', icon: 'overview', to: '/', permission: null },
    ],
  },
  {
    title: 'E-Commerce',
    items: [
      { label: 'Orders', icon: 'orders', to: '/orders', permission: 'orders.view', badge: 12 },
      { label: 'Products', icon: 'products', to: '/products', permission: 'products.view' },
      { label: 'Categories', icon: 'categories', to: '/categories', permission: 'categories.view' },
      { label: 'Promotions', icon: 'promotions', to: '/promotions', permission: 'promotions.view' },
      { label: 'Stock Management', icon: 'stock', to: '/stock', permission: 'stock.view' },
      { label: 'Reports', icon: 'reports', to: '/reports', permission: 'logs.view' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Slides', icon: 'slides', to: '/slides', permission: 'banners.view' },
      { label: 'News', icon: 'news', to: '/news', permission: 'content.view' },
    ],
  },
  {
    title: 'Users',
    items: [
      { label: 'Customers', icon: 'customers', to: '/customers', permission: 'customers.view' },
      {
        label: 'Administrators',
        icon: 'administrators',
        to: '/administrators',
        permission: 'administrators.view',
      },
      {
        label: 'Roles & Permissions',
        icon: 'roles',
        to: '/roles',
        permission: 'roles.view',
      },
      { label: 'Logs', icon: 'logs', to: '/logs', permission: 'logs.view' },
    ],
  },
]

// Items the caller may not see are removed; a section left with no items is
// dropped so its heading does not linger over empty space.
export function visibleSections(hasPermission) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => hasPermission(item.permission)),
  })).filter((section) => section.items.length > 0)
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test:run -- src/lib/navigation.spec.js
```

Expected: 5 passed.

- [ ] **Step 5: Consume it in the component**

In `src/components/AppSidebar.vue`, add to the `<script setup>` imports:

```js
import { computed } from 'vue'
import { visibleSections } from '@/lib/navigation'
```

Then delete the entire `const sections = [ ... ]` array — including its `// Nav model — grouped to match the Admin Portal layout.` comment block and the commented-out News line — and replace it with:

```js
// Nav model lives in @/lib/navigation so the permission filtering is unit
// testable. Items the signed-in role may not see are dropped, and a section
// left empty disappears with them.
const sections = computed(() => visibleSections((permission) => auth.hasPermission(permission)))
```

The template needs no change: `v-for="section in sections"` unwraps the computed automatically.

- [ ] **Step 6: Verify with a real manager account**

Create a manager in the backend, then sign in as them in the portal.

```bash
cd /c/Users/U-ser/Documents/SARANA-08-TEAM/bekie-service
export PATH="$PATH:/c/tools/php84"
php artisan tinker --execute='
$u = \App\Models\User::updateOrCreate(
  ["email" => "manager@example.com"],
  ["first_name"=>"Manager","last_name"=>"User","password"=>\Illuminate\Support\Facades\Hash::make("password"),
   "role"=>"manager","is_admin"=>true,"is_active"=>true,"is_banned"=>false]
);
$u->syncRoles(["manager"]);
echo "manager ready, permissions: ".$u->getAllPermissions()->count().PHP_EOL;
'
```

Expected: `manager ready, permissions: 22`.

Sign in to the portal as `manager@example.com` / `password` and confirm the sidebar shows exactly: Overview, Orders, Products, Categories, Promotions, Slides, News — with no Users section heading. Then navigate to `/roles` directly and confirm the 403 page appears.

- [ ] **Step 7: Verify tests and lint**

```bash
cd /c/Users/U-ser/Documents/SARANA-08-TEAM/BackieDealFrontEnd
npm run test:run
npm run lint
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/navigation.js src/lib/navigation.spec.js src/components/AppSidebar.vue
git commit -m "$(cat <<'MSG'
feat(nav): hide sidebar items the signed-in role cannot use

The nav model moves to lib/navigation.js as data with a permission per item,
so the filtering rule is unit testable. A section whose every item is denied
is dropped along with its heading, so a manager sees Overview, Orders,
Products, Categories, Promotions, Slides and News and no empty Users
heading.

News returns to the nav, gated on content.view.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 11: Gate in-view action buttons

A manager reaching Products must not be offered Delete, and Orders must be read-only apart from approve/reject. The UI should never offer an action the API will refuse.

**Files:**
- Modify: `src/views/ProductsView.vue`
- Modify: `src/views/CategoriesView.vue`
- Modify: `src/views/OrdersView.vue`
- Modify: `src/views/OrderDetailView.vue`
- Modify: `src/views/SlidesView.vue`
- Modify: `src/views/NewsView.vue`
- Modify: `src/views/PromotionsView.vue`

**Interfaces:**
- Consumes: `auth.hasPermission` from Task 7.
- Produces: nothing other tasks call.

- [ ] **Step 1: Locate the controls in each view**

The exact markup differs per view, so find the controls before editing rather than guessing at their shape:

```bash
cd /c/Users/U-ser/Documents/SARANA-08-TEAM/BackieDealFrontEnd
grep -n "BaseButton\|<button\|@click" \
  src/views/ProductsView.vue src/views/CategoriesView.vue src/views/OrdersView.vue \
  src/views/OrderDetailView.vue src/views/SlidesView.vue src/views/NewsView.vue \
  src/views/PromotionsView.vue
```

Work through the results view by view, matching each control to the table below. A control that neither creates, edits, deletes, approves nor rejects — a filter, an export, a pagination button — is left alone.

- [ ] **Step 2: Apply the gate to each view**

For each view above, ensure the auth store is available in `<script setup>` (most already import it for `auth.accessToken`; add it where missing):

```js
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
```

Then add `v-if` to the control elements using this mapping:

| View | Control | Guard |
| --- | --- | --- |
| ProductsView | "New Product" / add button | `v-if="auth.hasPermission('products.create')"` |
| ProductsView | Edit action | `v-if="auth.hasPermission('products.update')"` |
| ProductsView | Delete action, bulk delete | `v-if="auth.hasPermission('products.delete')"` |
| CategoriesView | New / add button | `v-if="auth.hasPermission('categories.create')"` |
| CategoriesView | Edit action | `v-if="auth.hasPermission('categories.update')"` |
| CategoriesView | Delete action | `v-if="auth.hasPermission('categories.delete')"` |
| OrdersView | "New Order" button | `v-if="auth.hasPermission('orders.create')"` |
| OrdersView | Edit action | `v-if="auth.hasPermission('orders.update')"` |
| OrdersView | Delete action | `v-if="auth.hasPermission('orders.delete')"` |
| OrdersView, OrderDetailView | Approve / Reject | `v-if="auth.hasPermission('orders.approve')"` |
| SlidesView | New button | `v-if="auth.hasPermission('banners.create')"` |
| SlidesView | Edit action | `v-if="auth.hasPermission('banners.update')"` |
| SlidesView | Delete action | `v-if="auth.hasPermission('banners.delete')"` |
| NewsView | New button | `v-if="auth.hasPermission('content.create')"` |
| NewsView | Edit action | `v-if="auth.hasPermission('content.update')"` |
| NewsView | Delete action | `v-if="auth.hasPermission('content.delete')"` |
| PromotionsView | New button | `v-if="auth.hasPermission('promotions.create')"` |
| PromotionsView | Edit action | `v-if="auth.hasPermission('promotions.update')"` |
| PromotionsView | Delete action | `v-if="auth.hasPermission('promotions.delete')"` |

Worked example — a Products "New Product" button that currently reads:

```vue
        <BaseButton :to="{ name: 'product-create' }">New Product</BaseButton>
```

becomes:

```vue
        <BaseButton
          v-if="auth.hasPermission('products.create')"
          :to="{ name: 'product-create' }"
        >New Product</BaseButton>
```

Where an element already has a `v-if`, combine with `&&` rather than adding a second directive — Vue allows only one `v-if` per element:

```vue
        <button v-if="row.status === 'pending' && auth.hasPermission('orders.approve')">
```

- [ ] **Step 3: Verify each view by hand as a manager**

With both servers running and signed in as `manager@example.com`:

- `/products` — "New Product" and Edit visible, Delete and bulk-delete absent
- `/categories` — New and Edit visible, Delete absent
- `/orders` — Approve and Reject visible, "New Order" / Edit / Delete absent
- `/orders/:id` — Approve and Reject visible
- `/slides`, `/news`, `/promotions` — New and Edit visible, Delete absent

Then sign in as `admin@example.com` and confirm every control is back.

- [ ] **Step 4: Verify tests and lint**

```bash
npm run test:run
npm run lint
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/views/ProductsView.vue src/views/CategoriesView.vue src/views/OrdersView.vue src/views/OrderDetailView.vue src/views/SlidesView.vue src/views/NewsView.vue src/views/PromotionsView.vue
git commit -m "$(cat <<'MSG'
feat(views): hide actions the signed-in role cannot perform

Create, edit and delete controls are gated on the matching permission, so
the UI stops offering actions the API will refuse with a 403. A manager sees
no Delete anywhere, and Orders is read-only apart from Approve and Reject.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

### Task 12: Stop a stock 403 from blanking the product totals

`ProductsView.loadSummary()` fetches the catalog total and `/admin/stock/alerts` under one `Promise.all`. A manager has no `stock.view`, so that 403 rejects the pair and the catch blanks all four stat cards — including the catalog total, which had loaded fine.

**Files:**
- Modify: `src/views/ProductsView.vue:243-264`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks call.

- [ ] **Step 1: Rewrite loadSummary**

In `src/views/ProductsView.vue`, replace the body of `loadSummary()`:

```js
async function loadSummary() {
  try {
    const [catalog, alerts] = await Promise.all([
      apiFetch('/admin/products?page=1&per_page=1', { token: auth.accessToken }),
      apiFetch('/admin/stock/alerts', { token: auth.accessToken }),
    ])

    const catalogTotal = catalog?.data?.pagination?.total ?? null
    const rows = Array.isArray(alerts?.data) ? alerts.data : []
    const out = rows.filter((row) => Number(row.stock_quantity ?? 0) <= 0).length

    summary.value = {
      total: catalogTotal,
      low: rows.length - out,
      out,
      inStock: catalogTotal == null ? null : Math.max(0, catalogTotal - rows.length),
    }
  } catch {
    summary.value = { total: null, low: null, out: null, inStock: null }
  }
}
```

with:

```js
async function loadSummary() {
  // allSettled, not all: a role without stock.view gets a 403 from
  // /admin/stock/alerts, and Promise.all would reject the pair and blank the
  // catalog total that had already loaded fine. Each card degrades on its own.
  const [catalogResult, alertsResult] = await Promise.allSettled([
    apiFetch('/admin/products?page=1&per_page=1', { token: auth.accessToken }),
    apiFetch('/admin/stock/alerts', { token: auth.accessToken }),
  ])

  const catalogTotal =
    catalogResult.status === 'fulfilled'
      ? (catalogResult.value?.data?.pagination?.total ?? null)
      : null

  if (alertsResult.status !== 'fulfilled') {
    summary.value = { total: catalogTotal, low: null, out: null, inStock: null }
    return
  }

  const rows = Array.isArray(alertsResult.value?.data) ? alertsResult.value.data : []
  const out = rows.filter((row) => Number(row.stock_quantity ?? 0) <= 0).length

  summary.value = {
    total: catalogTotal,
    low: rows.length - out,
    out,
    inStock: catalogTotal == null ? null : Math.max(0, catalogTotal - rows.length),
  }
}
```

- [ ] **Step 2: Verify as a manager**

Signed in as `manager@example.com`, open `/products`. The total-products stat shows a real number; the Low Stock, Out of Stock and In Stock cards show `—`. Confirm the browser network tab shows the 403 on `/admin/stock/alerts` and that no unhandled rejection appears in the console.

- [ ] **Step 3: Verify as an admin**

Signed in as `admin@example.com`, open `/products` and confirm all four cards show numbers, unchanged from before.

- [ ] **Step 4: Run the full frontend suite and lint**

```bash
npm run test:run
npm run lint
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/views/ProductsView.vue
git commit -m "$(cat <<'MSG'
fix(products): keep the catalog total when stock alerts are forbidden

loadSummary fetched the catalog total and /admin/stock/alerts under one
Promise.all, so a role without stock.view lost both to the 403 and all four
stat cards blanked. allSettled lets each degrade on its own, which is what
the surrounding comment already promised.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
MSG
)"
```

---

## Final verification

- [ ] **Backend suite green**

```bash
cd /c/Users/U-ser/Documents/SARANA-08-TEAM/bekie-service
export PATH="$PATH:/c/tools/php84"
php vendor/bin/pest
```

- [ ] **Frontend suite and lint green**

```bash
cd /c/Users/U-ser/Documents/SARANA-08-TEAM/BackieDealFrontEnd
npm run test:run
npm run lint
npm run build
```

- [ ] **Manager end-to-end walkthrough**

Signed in as `manager@example.com` / `password`:

1. Sidebar shows exactly Overview, Orders, Products, Categories, Promotions, Slides, News.
2. No Users section heading appears.
3. `/roles`, `/administrators`, `/customers`, `/logs`, `/stock`, `/reports` each land on the 403 page when typed directly.
4. Products offers New and Edit, never Delete.
5. Orders offers Approve and Reject, never New, Edit or Delete.
6. Profile loads; changing the password succeeds.
7. Logout works.

- [ ] **Admin regression walkthrough**

Signed in as `admin@example.com` / `password`: every nav item and every action control is present, and Roles & Permissions still functions — including creating a role, syncing its permissions and deleting it.
