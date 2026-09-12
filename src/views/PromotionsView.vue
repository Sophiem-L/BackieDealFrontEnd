<template>
  <v-container fluid class="pa-2">
    <v-breadcrumbs :items="breadcrumbs">
        <template #prepend>
            <v-icon size="small" icon="mdi-home" />
        </template>
        <template #divider>
            <v-icon icon="mdi-chevron-right" />
        </template>
    </v-breadcrumbs>
    <v-card rounded="lg" border variant="flat">
      <v-card-subtitle tag="h1" class="subtitle-2 border-b pa-3">Manage System Roles</v-card-subtitle>
    <div class="d-flex align-center justify-space-between" style="padding:0px 14px 14px 14px">
      <div>
        <v-text-field
          v-model="search"
          type="text"
          variant="outlined"
          hide-details="auto"
          placeholder="Search Name"
          density="compact"
          class="search"
          rounded="lg"
          prepend-inner-icon="mdi-magnify"
      ></v-text-field>
      </div>
      <div>
      <v-btn
        color="info"
        prepend-icon="mdi-filter"
        variant="flat"
        class="ml-2"
        rounded="lg"
        @click="openFilter"
      >
        Filter
      </v-btn>
      <v-btn
        v-if="can('roles.create')"
        color="primary"
        prepend-icon="mdi-plus"
        variant="flat"
        class="ml-2"
        rounded="lg"
        :to="localePath('/security/roles/create')"
      >
        Create
      </v-btn>
      </div>
    </div>
    <v-divider />
    <div v-show="showFilter" style="padding:14px 14px 0px 14px">
        <v-row>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="name"
              label="Name"
              variant="outlined"
              hide-details="auto"
              density="compact"
              rounded="lg"
              placeholder="Enter Name"
            />
          </v-col>

          <v-col cols="12" sm="4">
            <v-select
              v-model="status"
              :items="statusOption"
              item-title="name"
              item-value="id"
              variant="outlined"
              density="compact"
              label="Status"
              rounded="lg"
              placeholder="Select Status"
              clearable
            />
          </v-col>
        </v-row>

        <div class="d-flex justify-end">
          <v-btn
            color="warning"
            prepend-icon="mdi-filter-remove"
            variant="flat"
            class="mr-2"
            rounded="lg"
            @click="resetFilter"
          >
            Reset
          </v-btn>
          <v-btn
            color="success"
            prepend-icon="mdi-magnify"
            variant="flat"
            @click="applyFilter"
            rounded="lg"
          >
            Apply
          </v-btn>
        </div>
        </div>
      <div
        v-if="activeFilters.length"
        class="d-flex align-center flex-wrap ga-2"
        style="padding:14px 14px 0px 14px"
      >
        <span class="text-medium-emphasis text-caption">Filter:</span>
        <v-chip
          v-for="filter in activeFilters"
          :key="filter.key"
          color="info"
          size="small"
          variant="tonal"
          closable
          @click:close="removeFilter(filter.key)"
        >
          <span class="font-weight-medium">{{ filter.label }}:</span>&nbsp;{{ filter.text }}
        </v-chip>
        <v-btn
          color="error"
          variant="text"
          size="small"
          density="comfortable"
          prepend-icon="mdi-close"
          rounded="lg"
          @click="resetFilter"
        >
        Clear All
        </v-btn>
      </div>
      <v-card-text>
      <v-data-table-server
        v-model:options="options"
        :headers="headers"
        :items="roles"
        :items-length="totalItems"
        :loading="loading"
        class="custom-table"
        :items-per-page-options="[10, 25, 50, 100]"
        hide-default-footer
      >
        <template #[`item.index`]="{ item }">
          {{ roles.indexOf(item) + 1 + (page - 1) * itemsPerPage }}
        </template>
        <template #item.status="{ item }">
          <v-chip
            :color="statusVariant(item.deleted_at ? 2 : 1).color"
            :class="`text-${statusVariant(item.deleted_at ? 2 : 1).color}`"
            size="small"
            class="font-weight-medium"
          >
            <v-icon start :icon="statusVariant(item.deleted_at ? 2 : 1).icon" />
            {{ statusVariant(item.deleted_at ? 2 : 1).text }}
          </v-chip>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-menu location="bottom end">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-dots-vertical"
                size="small"
                variant="text"
                color="default"
              />
            </template>

            <v-list density="compact" min-width="160">
              <v-list-item
                v-if="can('roles.update')"
                prepend-icon="mdi-square-edit-outline"
                title="Edit"
                base-color="primary"
                :to="localePath(`/security/roles/${item.id}`)"
              />
              <v-list-item
                v-if="can('roles.assign-permission')"
                prepend-icon="mdi-key-outline"
                title="Permission"
                base-color="info"
                @click="openPermission(item.id)"
              />
              <v-list-item
                v-if="can('roles.delete')"
                prepend-icon="mdi-trash-can-outline"
                title="Delete"
                base-color="error"
                @click="deleteData(item.id)"
              />
            </v-list>
          </v-menu>
        </template>
        <template #no-data>
          <div class="text-center py-8 text-medium-emphasis">
            No role found
          </div>
        </template>
      </v-data-table-server>
      </v-card-text>
      <Pagination
        v-model:page="page"
        v-model:items-per-page="itemsPerPage"
        :total="totalItems"
      />
      <ConfirmDialog ref="confirmRef" />
    </v-card>

    <v-dialog v-model="dialog" max-width="1100">
      <v-card rounded="lg" class="d-flex flex-column" style="height: 80vh;">
        <!-- Header -->
        <v-card-title class="d-flex justify-space-between">
          <div class="pa-2">
            <div class="text-h6 font-weight-bold mb-2">Manage Permissions</div>
            <div>
             Assign or remove permission for the
              <span class="text-primary font-weight-medium">{{role.name}}</span> role
            </div>
          </div>

          <v-btn icon="mdi-close" variant="text" @click="dialog = false" />
        </v-card-title>

        <!-- Search + Action -->
          <div class="d-flex gap-3 align-center" style="padding: 0px 20px">
            <v-text-field
              v-model="search_permission"
              type="text"
              variant="outlined"
              hide-details="auto"
              placeholder="Search by module or permission name"
              density="compact"
              class="flex-grow-1"
              rounded="lg"
              prepend-inner-icon="mdi-magnify"
          ></v-text-field>
            <v-btn
              :color="isAllChecked ? 'error' : 'primary'"
              variant="outlined"
              rounded="lg"
              @click="toggleAll"
            >
              {{ isAllChecked ? 'Uncheck All' : 'Check All' }}
            </v-btn>
          </div>
        <v-card-text class="flex-grow-1 overflow-y-auto">
          <v-row v-if="loading">
              <v-col cols="12" md="6" v-for="n in 4" :key="n">
                <v-skeleton-loader type="card" />
              </v-col>
          </v-row>
          <v-row v-else-if="filteredModules.length === 0">
            <v-col cols="12" class="text-center py-5 text-medium-emphasis">
                    No permission found
            </v-col>
          </v-row>
          <v-row v-else>
            <v-col
              v-for="module in filteredModules"
              :key="module.name"
              cols="12"
              md="4"
            >
              <v-card rounded="lg" class="h-100 d-flex flex-column">
                <!-- Module Header -->
                <v-card-title class="d-flex justify-space-between align-center" style="height: 65px;">
                  <div class="d-flex align-center gap-2">
                    <v-checkbox
                      v-model="module.checked"
                      :indeterminate="module.indeterminate"
                      @update:model-value="toggleModule(module)"
                      class="mt-5"
                    />
                    <span class="font-weight-medium">{{ module.name }}</span>
                  </div>

                  <v-chip size="small">
                    {{ checkedCount(module) }} / {{ module.permissions.length }}
                  </v-chip>
                </v-card-title>

                <!-- Permissions -->
                <v-card-text class="pt-0 flex-grow-1">
                  <div
                    v-for="perm in module.permissions"
                    :key="perm.id"
                    class="d-flex align-center justify-space-between mb-2 pa-1 rounded cursor-pointer" style="background-color:rgba(207, 204, 204, 0.164);"
                    @click="togglePermission(module, perm)"
                  >
                    <div class="d-flex align-center gap-2">
                      <v-checkbox
                        v-model="perm.checked"
                        hide-details
                        density="compact"
                        @update:model-value="updateModuleState(module)"
                      />
                      <span class="text-body-2">{{ perm.name }}</span>
                    </div>

                    <v-chip
                      size="x-small"
                      :color="getColor(perm.name)"
                      variant="flat"
                      @click.stop="togglePermission(module, perm)"
                    >
                      {{ perm.name }}
                    </v-chip>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
          <v-divider></v-divider>
          <v-card-actions class="pa-4">
            <v-spacer />
            <v-btn color="grey" rounded="lg" variant="flat" @click="dialog = false"><v-icon left>mdi-chevron-left-circle</v-icon>Cancel</v-btn>
            <v-btn v-if="can('roles.update')" color="primary" rounded="lg" variant="flat" @click="updatePermission(role.id)"><v-icon left>mdi-content-save</v-icon>Save Permissions</v-btn>
          </v-card-actions>
      </v-card>
    </v-dialog>
  <AppFooter/>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

interface DataTableOptions {
  page: number
  itemsPerPage: number
  sortBy: { key: string; order: 'asc' | 'desc' }[]
  search?: string
}

const confirmRef = ref<{ openConfirm: (title: string, message: string) => Promise<boolean> } | null>(null)

const { $api, $toast } = useNuxtApp();
const { can } = usePermission();
const localePath = useLocalePath();
const breadcrumbs = [
  { title: 'Dashboard', to: localePath('/'), disabled: false },
  { title: 'Security', disabled: true },
  { title: 'Roles', disabled: true },
]

interface Role {
  id: number
  name: string
  guard_name: string
  deleted_at: string | null
  created_at: string
}

const search = ref('');
const name = ref('')
const status = ref()
const loading = ref(false);
const itemsPerPage = ref(10)
const page = ref(1)
const totalItems = ref(0);
const roles = ref<Role[]>([]);
const filters = ref('')
const showFilter = ref(false)
const appliedFilters = ref<{ name: string; status: number | undefined }>({
  name: '',
  status: undefined,
})

const headers = [
  { title: '#', key: 'index' },
  { title: 'Name', key: "name" },
  { title: 'Guard Name', key: "guard_name" },
  { title: 'Status', key: "status" },
  { title: 'Created At', key: "created_at" },
  { title: 'Action', key: "actions", sortable: false, align: "end" as const },
];

const options = ref<DataTableOptions>({
  page: 1,
  itemsPerPage: 10,
  sortBy: [],
  search: ''
});

const fetchData = async (opts: DataTableOptions) => {
  loading.value = true;
  try {
    const res: any = await $api('/admin/roles', {
      method: 'GET',
      query: {
        q: appliedFilters.value.name || opts.search,
        page: opts.page,
        per_page: opts.itemsPerPage,
      },
    });
    roles.value = res.data.items;
    totalItems.value = res.data.pagination.total;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

watch(
  [search, page, itemsPerPage],
  ([s, p, ipp], [oldS]) => {
    const isSearchChanged = s !== oldS
    options.value = {
      ...options.value,
      search: s,
      page: isSearchChanged ? 1 : p,
      itemsPerPage: ipp,
    }
  }
)

watch(options, async (newOptions) => {
  await fetchData(newOptions);
}, { deep: true });

const openFilter = function () {
  filters.value = filters.value ? '' : '0'
  showFilter.value = !showFilter.value
}

const applyFilter = () => {
  appliedFilters.value = {
    name: name.value,
    status: status.value,
  }
  options.value = {
    ...options.value,
    page: 1,
  }
  showFilter.value = false;
}

const resetFilter = () => {
  name.value = ''
  status.value = undefined
  appliedFilters.value = {
    name: '',
    status: undefined,
  }
  options.value = {
    ...options.value,
    page: 1,
  }
  showFilter.value = false;
}

const activeFilters = computed(() => {
  const list: { key: 'name' | 'status'; label: string; text: string }[] = []
  if (appliedFilters.value.name) {
    list.push({ key: 'name', label: 'Name', text: appliedFilters.value.name })
  }
  if (appliedFilters.value.status != null) {
    const opt = statusOption.find((s) => s.id === appliedFilters.value.status)
    list.push({ key: 'status', label: 'Status', text: opt?.name ?? String(appliedFilters.value.status) })
  }
  return list
})

const removeFilter = (key: 'name' | 'status') => {
  if (key === 'status') {
    status.value = undefined
    appliedFilters.value = { ...appliedFilters.value, status: undefined }
  } else {
    if (key === 'name') name.value = ''
    appliedFilters.value = { ...appliedFilters.value, [key]: '' }
  }
  options.value = {
    ...options.value,
    page: 1,
  }
}

const statusOption = [
    { id: 1, name: 'Active' },
    { id: 2, name: 'Inactive' },
]

const statusVariant = (status: number) => {
  if (status == 1) return { color: 'success', text: 'Active', icon: 'mdi-check-circle' }
  else return { color: 'primary', text: 'Inactive', icon: 'mdi-close-circle' }
}

const deleteData = async (id: number) => {
    const confirmed = await confirmRef.value?.openConfirm(
      'Delete',
      'Are you sure you want to delete this record?'
    )
    if (confirmed) {
      try {
        await $api(`/admin/roles/${id}`, {
          method: 'DELETE',
        });
        ($toast as any).success('Role deleted successfully');
        await fetchData(options.value);
      }
      catch (error: any) {
        if (error.response?._data?.message) {
          ($toast as any).error(error.response._data.message)
        }
        else {
          ($toast as any).error('Failed to delete role')
        }
      }
    }
}

// Permission Management Modal Logic
const dialog = ref(false);
const search_permission = ref("");
const selectedRoleId = ref<number | null>(null)
const role = ref({
    id: null as number | null,
    name: null as string | null
});

const openPermission = (id: number) => {
  selectedRoleId.value = id
  dialog.value = true
}

const togglePermission = (module: any, perm: any) => {
  perm.checked = !perm.checked
  updateModuleState(module)
}

watch(dialog, async (val) => {
  if (val && selectedRoleId.value) {
    await getRole(selectedRoleId.value)
    await getPermissions()
  }
})

const getRole = async (id: number) => {
    try {
        const res: any = await $api(`/admin/roles/${id}`)
        const data = res.data
        role.value = {
            id: data.id,
            name: data.name,
        }
    }
    catch (error) {
        console.error(error)
    }
};

const modules = ref<any[]>([])

const getPermissions = async () => {
  loading.value = true
  try {
    const res: any = await $api('/admin/permissions?per_page=100')
    const allPermissions = res.data.items || []

    const roleRes: any = await $api(`/admin/roles/${selectedRoleId.value}`)
    const assignedPermissions = roleRes.data.permissions || []
    const assignedIds = assignedPermissions.map((p: any) => p.id)

    const groupedMap: { [key: string]: any[] } = {}
    allPermissions.forEach((p: any) => {
      const parts = p.name.split('.')
      const moduleName = parts.length > 1 ? parts[0] : 'general'
      if (!groupedMap[moduleName]) {
        groupedMap[moduleName] = []
      }
      groupedMap[moduleName].push({
        id: p.id,
        name: p.name,
        checked: assignedIds.includes(p.id)
      })
    })

    modules.value = Object.keys(groupedMap).map((modName) => ({
      name: modName.toUpperCase(),
      checked: false,
      indeterminate: false,
      permissions: groupedMap[modName]
    }))

    modules.value.forEach(m => updateModuleState(m))
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const filteredModules = computed(() => {
  if (!search_permission.value) return modules.value;
  const keyword = search_permission.value.toLowerCase();
  return modules.value
    .map((m) => {
      const moduleMatch = m.name.toLowerCase().includes(keyword);
      const filteredPermissions = m.permissions.filter((p: any) =>
        p.name.toLowerCase().includes(keyword)
      );
      if (moduleMatch) {
        return m;
      }
      if (filteredPermissions.length > 0) {
        return {
          ...m,
          permissions: filteredPermissions,
        };
      }
      return null;
    })
    .filter((m): m is typeof modules.value[number] => m !== null);
});

const isAllChecked = computed(() => {
  return modules.value.length > 0 && modules.value.every((m) =>
    m.permissions.every((p: any) => p.checked)
  );
});

const toggleAll = () => {
  const newValue = !isAllChecked.value;
  modules.value.forEach((m) => {
    m.checked = newValue;
    m.permissions.forEach((p: any) => (p.checked = newValue));
  });
};

const updateModuleState = (module: any) => {
  const total = module.permissions.length;
  const checked = module.permissions.filter((p: any) => p.checked).length;
  module.checked = checked === total;
  module.indeterminate = checked > 0 && checked < total;
};

const toggleModule = (module: any) => {
  module.indeterminate = false;
  module.permissions.forEach((p: any) => {
    p.checked = module.checked;
  });
};

const checkedCount = (module: any) => {
  return module.permissions.filter((p: any) => p.checked).length;
};

const getColor = (name: string) => {
  if (name.includes('create')) return "green";
  if (name.includes('view') || name.includes('read')) return "grey";
  if (name.includes('update')) return "blue";
  if (name.includes('delete')) return "red";
  return "grey";
};

const updatePermission = async (id: number | null) => {
    if (!id) return
    loading.value = true
    try {
        const selectedPermissionIds = modules.value
            .flatMap(m => m.permissions)
            .filter((p: any) => p.checked)
            .map((p: any) => p.id)

        await $api(`/admin/roles/${id}/permissions`, {
            method: 'POST',
            body: {
              permissions: selectedPermissionIds
            }
        })
        
        dialog.value = false;
        ($toast as any).success('Permissions updated successfully')
    }
    catch (error: any) {
        if (error.response?._data?.message) {
            ($toast as any).error(error.response._data.message)
        }
        else {
            ($toast as any).error('Failed to update permissions')
        }
    }
    finally {
        loading.value = false
    }
}
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}
.gap-3 {
  gap: 12px;
}
.cursor-pointer {
  cursor: pointer;
}
</style>