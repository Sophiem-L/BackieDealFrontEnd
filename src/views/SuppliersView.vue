<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import BaseButton from '@/components/BaseButton.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import {
  blankSupplier,
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  updateSupplier,
} from '@/services/suppliers'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toasts'

const auth = useAuthStore()
const toast = useToastStore()

const canCreate = computed(() => auth.hasPermission('suppliers.create'))
const canEdit = computed(() => auth.hasPermission('suppliers.update'))
const canDelete = computed(() => auth.hasPermission('suppliers.delete'))

const search = ref('')
const suppliers = ref([])
const pagination = ref({})
const page = ref(1)
const loading = ref(false)
const error = ref('')
const deletingId = ref(null)

let searchTimer = null

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchSuppliers({ q: search.value.trim(), page: page.value }, auth.accessToken)
    suppliers.value = result.items
    pagination.value = result.pagination
  } catch (err) {
    error.value = err.message || 'Unable to load suppliers. Please try again.'
  } finally {
    loading.value = false
  }
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    load()
  }, 300)
}

function goToPage(next) {
  page.value = next
  load()
}

onMounted(load)

// The side panel: closed, creating (`form.id` null) or editing one supplier.
const panelOpen = ref(false)
const form = reactive(blankSupplier())
const saving = ref(false)
const saveError = ref('')

const panelTitle = computed(() => (form.id ? 'Edit Supplier' : 'New Supplier'))

function openCreate() {
  Object.assign(form, blankSupplier())
  saveError.value = ''
  panelOpen.value = true
}

function openEdit(supplier) {
  Object.assign(form, blankSupplier(), supplier)
  saveError.value = ''
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
}

async function save() {
  if (!form.name.trim()) {
    saveError.value = 'Supplier name is required.'
    return
  }
  saving.value = true
  saveError.value = ''
  try {
    const editing = Boolean(form.id)
    const saved = editing
      ? await updateSupplier(form.id, form, auth.accessToken)
      : await createSupplier(form, auth.accessToken)
    if (editing) toast.updated('Supplier updated', `Changes to "${saved.name}" were saved.`)
    else toast.success('Supplier created', `"${saved.name}" was added.`)
    panelOpen.value = false
    // Marking a default clears it on another row, so reload rather than patch.
    await load()
  } catch (err) {
    const fieldError = Object.values(err?.errors ?? {}).flat()[0]
    saveError.value = fieldError || err?.message || 'Unable to save this supplier.'
  } finally {
    saving.value = false
  }
}

async function remove(supplier) {
  if (!window.confirm(`Delete supplier "${supplier.name}"? Stock history will keep its name.`)) return
  deletingId.value = supplier.id
  try {
    await deleteSupplier(supplier.id, auth.accessToken)
    toast.deleted('Supplier deleted', `"${supplier.name}" was removed.`)
    if (form.id === supplier.id) panelOpen.value = false
    await load()
  } catch (err) {
    // 422 when products still use it as their default supplier.
    toast.error('Could not delete supplier', err?.message || `Unable to delete "${supplier.name}".`)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="page">
    <AppHeader title="Suppliers" />

    <div class="page__body">
      <div class="toolbar">
        <label class="toolbar__search">
          <span class="toolbar__search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" /></svg>
          </span>
          <input
            v-model="search"
            type="search"
            placeholder="Search by name, code, contact, phone or email…"
            aria-label="Search suppliers"
            @input="onSearch"
          />
        </label>
        <div class="toolbar__actions">
          <BaseButton v-if="canCreate" variant="primary" @click="openCreate">Add Supplier</BaseButton>
        </div>
      </div>

      <div class="layout" :class="{ 'layout--with-panel': panelOpen }">
        <section class="table-card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact</th>
                  <th>Phone / Email</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th v-if="canEdit || canDelete" class="table__actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="error">
                  <td colspan="6" class="table__state table__state--error">
                    {{ error }}
                    <button type="button" class="table__retry" @click="load">Retry</button>
                  </td>
                </tr>
                <tr v-else-if="loading && !suppliers.length">
                  <td colspan="6" class="table__state">Loading suppliers…</td>
                </tr>
                <tr v-else-if="!suppliers.length">
                  <td colspan="6" class="table__state">
                    {{ search ? 'No suppliers match your search.' : 'No suppliers yet.' }}
                  </td>
                </tr>
                <tr
                  v-for="supplier in suppliers"
                  v-else
                  :key="supplier.id"
                  :class="{ 'table__row--loading': loading, 'table__row--active': panelOpen && form.id === supplier.id }"
                >
                  <td>
                    <div class="name-cell">
                      <span class="name-cell__name">{{ supplier.name }}</span>
                      <span v-if="supplier.code" class="name-cell__code">{{ supplier.code }}</span>
                    </div>
                  </td>
                  <td class="muted">{{ supplier.contactPerson || '—' }}</td>
                  <td class="muted">
                    <div class="stack">
                      <span>{{ supplier.phone || '—' }}</span>
                      <span v-if="supplier.email">{{ supplier.email }}</span>
                    </div>
                  </td>
                  <td class="muted">{{ supplier.productsCount }}</td>
                  <td>
                    <span class="badge" :class="supplier.isActive ? 'badge--on' : 'badge--off'">
                      {{ supplier.isActive ? 'Active' : 'Inactive' }}
                    </span>
                    <span v-if="supplier.isDefault" class="badge badge--default">Default</span>
                  </td>
                  <td v-if="canEdit || canDelete" class="actions-cell">
                    <BaseButton v-if="canEdit" variant="ghost" size="sm" @click="openEdit(supplier)">Edit</BaseButton>
                    <BaseButton
                      v-if="canDelete"
                      variant="ghost"
                      size="sm"
                      :disabled="deletingId === supplier.id"
                      @click="remove(supplier)"
                    >
                      {{ deletingId === supplier.id ? 'Deleting…' : 'Delete' }}
                    </BaseButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer v-if="(pagination.last_page ?? 1) > 1" class="pager">
            <span class="muted">Page {{ pagination.current_page }} of {{ pagination.last_page }} · {{ pagination.total }} suppliers</span>
            <div class="pager__buttons">
              <BaseButton variant="ghost" size="sm" :disabled="page <= 1 || loading" @click="goToPage(page - 1)">Previous</BaseButton>
              <BaseButton variant="ghost" size="sm" :disabled="page >= pagination.last_page || loading" @click="goToPage(page + 1)">Next</BaseButton>
            </div>
          </footer>
        </section>

        <form v-if="panelOpen" class="card panel" @submit.prevent="save">
          <h3 class="card__title">{{ panelTitle }}</h3>
          <p v-if="saveError" class="alert" role="alert">{{ saveError }}</p>

          <div class="field">
            <label for="supplier-name">Name</label>
            <input id="supplier-name" v-model="form.name" type="text" placeholder="e.g. Phnom Penh Components" required />
          </div>
          <div class="field">
            <label for="supplier-code">Code</label>
            <input id="supplier-code" v-model="form.code" type="text" placeholder="e.g. SUP-001" />
          </div>
          <div class="field">
            <label for="supplier-contact">Contact Person</label>
            <input id="supplier-contact" v-model="form.contactPerson" type="text" />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="supplier-phone">Phone</label>
              <input id="supplier-phone" v-model="form.phone" type="tel" />
            </div>
            <div class="field">
              <label for="supplier-email">Email</label>
              <input id="supplier-email" v-model="form.email" type="email" />
            </div>
          </div>
          <div class="field">
            <label for="supplier-address">Address</label>
            <textarea id="supplier-address" v-model="form.address" rows="2"></textarea>
          </div>
          <div class="field">
            <label for="supplier-tax">Tax ID</label>
            <input id="supplier-tax" v-model="form.taxId" type="text" />
          </div>
          <div class="field">
            <label for="supplier-notes">Notes</label>
            <textarea id="supplier-notes" v-model="form.notes" rows="2"></textarea>
          </div>

          <div class="toggles">
            <ToggleSwitch v-model="form.isActive" label="Active" />
            <!-- Only an active supplier can be the store default. -->
            <template v-if="form.isActive">
              <ToggleSwitch v-model="form.isDefault" label="Store default supplier" />
              <p class="hint">
                The stock form pre-selects the default supplier for a supplier delivery when the product has no default supplier of its own.
              </p>
            </template>
          </div>

          <div class="panel__actions">
            <BaseButton variant="ghost" :disabled="saving" @click="closePanel">Cancel</BaseButton>
            <BaseButton variant="primary" type="submit" :disabled="saving">
              {{ saving ? 'Saving…' : form.id ? 'Save' : 'Create' }}
            </BaseButton>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;

  &__body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 0.85rem 1rem;
  flex-wrap: wrap;

  &__search {
    flex: 1;
    min-width: 240px;
    display: flex;
    align-items: center;
    background: var(--bg);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0 0.75rem;

    &:focus-within {
      background: var(--surface);
      border-color: var(--border);
    }

    input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      padding: 0.6rem;
      font-size: 0.85rem;
      font-family: inherit;
      color: var(--text-strong);
      &:focus { outline: none; }
    }
  }

  &__search-icon {
    display: inline-flex;
    color: var(--text-subtle);
    svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 1.8; }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-left: auto;
  }
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  align-items: start;

  &--with-panel {
    grid-template-columns: minmax(0, 1fr) 360px;
    @media (max-width: 1100px) { grid-template-columns: 1fr; }
  }
}

.table-card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  overflow: hidden;
  min-width: 0;
}

.table-wrap { overflow-x: auto; }

.table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;

  th, td {
    text-align: left;
    padding: 0.9rem 1rem;
    vertical-align: middle;
    font-size: 0.85rem;
  }

  thead th {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    color: var(--text-subtle);
    border-bottom: 1px solid var(--border-subtle);
    background: var(--surface-sunken);

    &.table__actions-head { text-align: right; }
  }

  tbody tr + tr td { border-top: 1px solid var(--border-subtle); }
  tbody tr:hover { background: var(--surface-sunken); }

  &__row--loading { opacity: 0.6; pointer-events: none; }
  &__row--active td { background: rgb(var(--accent-rgb) / 0.08); }

  &__state {
    text-align: center;
    color: var(--text-subtle);
    font-size: 0.88rem;
    padding: 2.5rem 1rem;

    &--error { color: var(--danger); }
  }

  &__retry {
    margin-left: 0.6rem;
    padding: 0.3rem 0.7rem;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--text-body);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
  }
}

.muted { color: var(--text-muted); }

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;

  &__name { font-weight: 600; color: var(--text-strong); }
  &__code { font-size: 0.75rem; color: var(--text-subtle); }
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.actions-cell {
  text-align: right;
  white-space: nowrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.22rem 0.55rem;
  margin-right: 0.35rem;
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 6px;
  white-space: nowrap;

  &--on { color: var(--success); background: var(--success-bg); }
  &--off { color: var(--text-muted); background: var(--bg); }
  &--default { color: var(--accent-ink); background: rgb(var(--accent-rgb) / 0.16); }
}

.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.8rem;

  &__buttons { display: flex; gap: 0.5rem; }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border-subtle);
  border-radius: 14px;
  padding: 1.25rem;

  &__title {
    margin: 0 0 1rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
}

.panel {
  position: sticky;
  top: 1rem;

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 1.25rem;
  }
}

.alert {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  color: var(--danger);
  background: var(--danger-bg);
  border: 1px solid var(--danger-border);
  border-radius: 10px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 1rem;

  .field + .field { margin-top: 0; }
  @media (max-width: 520px) { grid-template-columns: 1fr; }
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-width: 0;

  & + .field { margin-top: 1rem; }

  label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-body);
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    font-size: 0.9rem;
    font-family: inherit;
    color: var(--text-strong);
    background: var(--surface);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &::placeholder { color: var(--text-faint); }
    &:focus {
      outline: none;
      border-color: rgb(var(--accent-rgb));
      box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.18);
    }
  }

  textarea { resize: vertical; }
}

.toggles {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding: 0.85rem;
  border-radius: 10px;
  background: var(--bg);
}

.hint {
  margin: 0;
  font-size: 0.72rem;
  color: var(--text-subtle);
}
</style>
