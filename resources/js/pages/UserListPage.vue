<script setup>
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import dayjs from 'dayjs';
import { FlexRender, tableFeatures, useTable } from '@tanstack/vue-table';
import { CircleAlert, KeyRound, Search, SearchX, ShieldCheck, UserCheck, UserX, Users, X } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppPagination from '@/components/AppPagination.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import http from '@/lib/http';
import { getErrorMessage } from '@/lib/apiErrors';
import { debounce } from '@/lib/debounce';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const PER_PAGE = 15;
const SEARCH_DELAY_MS = 300;

const STATUS_FILTERS = [
    { value: '', label: 'Semua' },
    { value: 'pending', label: 'Belum aktif' },
    { value: 'active', label: 'Aktif' },
];

const COLUMN_CLASSES = {
    account: '',
    role: 'hidden w-36 sm:table-cell',
    twoFactor: 'hidden w-32 lg:table-cell',
    lastLogin: 'hidden w-40 md:table-cell',
    actions: 'w-36 sm:w-44 text-right',
};

const authStore = useAuthStore();
const toast = useToast();
const users = ref([]);
const pagination = ref({ page: 1, per_page: PER_PAGE, total: 0, last_page: 1 });
const pendingCount = ref(0);
const isLoading = ref(true);
const hasLoadedOnce = ref(false);
const errorMessage = ref('');
const searchText = ref('');
const statusFilter = ref('');
const savingUserId = ref(null);
let latestRequestId = 0;

// Perubahan yang mengurangi akses (nonaktifkan, ubah peran, reset 2FA) selalu dikonfirmasi dulu.
const pendingChange = ref(null);
const isConfirmOpen = ref(false);

const hasActiveFilter = computed(() => searchText.value.trim() !== '' || statusFilter.value !== '');

function initialsOf(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}

function isCurrentUser(user) {
    return user.id === authStore.currentUser?.id;
}

function statusBadge(user) {
    return user.is_active
        ? h('span', { class: 'inline-flex rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700' }, 'Aktif')
        : h('span', { class: 'inline-flex rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700' }, 'Belum aktif');
}

function roleLabel(role) {
    return role === 'superadmin' ? 'Superadmin' : 'Member';
}

const columns = [
    {
        id: 'account',
        header: 'Akun',
        cell: ({ row }) =>
            h('div', { class: 'flex min-w-0 items-center gap-3' }, [
                h(
                    'span',
                    {
                        class: 'grid size-9 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-200 to-brand-500 font-display text-xs font-semibold text-ink-950',
                        'aria-hidden': 'true',
                    },
                    initialsOf(row.original.name),
                ),
                h('div', { class: 'min-w-0' }, [
                    h('p', { class: 'flex items-center gap-2' }, [
                        h('span', { class: 'truncate font-medium text-ink-900' }, row.original.name),
                        isCurrentUser(row.original) ? h('span', { class: 'shrink-0 text-xs text-ink-400' }, '(Anda)') : null,
                    ]),
                    h('p', { class: 'truncate font-mono text-xs text-ink-500' }, row.original.email),
                    h('div', { class: 'mt-1.5 flex flex-wrap items-center gap-1.5' }, [
                        statusBadge(row.original),
                        h('span', { class: 'text-xs text-ink-400' }, `${row.original.domains_count} link`),
                        h('span', { class: 'text-xs text-ink-400 sm:hidden' }, `· ${roleLabel(row.original.role)}`),
                    ]),
                ]),
            ]),
    },
    {
        id: 'role',
        header: 'Peran',
        cell: ({ row }) =>
            h(
                'span',
                {
                    class:
                        row.original.role === 'superadmin'
                            ? 'inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800'
                            : 'inline-flex rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-700',
                },
                roleLabel(row.original.role),
            ),
    },
    {
        id: 'twoFactor',
        header: '2FA',
        cell: ({ row }) =>
            h(
                'span',
                { class: row.original.has_two_factor ? 'text-sm text-success-700' : 'text-sm text-ink-400' },
                row.original.has_two_factor ? 'Terpasang' : 'Belum',
            ),
    },
    {
        id: 'lastLogin',
        header: 'Terakhir masuk',
        cell: ({ row }) =>
            h(
                'span',
                { class: 'text-sm whitespace-nowrap text-ink-500' },
                row.original.last_login_at ? dayjs(row.original.last_login_at).fromNow() : 'Belum pernah',
            ),
    },
    {
        id: 'actions',
        header: () => h('span', { class: 'sr-only' }, 'Aksi'),
        cell: ({ row }) => actionButtons(row.original),
    },
];

function actionButtons(user) {
    if (isCurrentUser(user)) {
        return h('span', { class: 'text-xs text-ink-400' }, '—');
    }

    const isSaving = savingUserId.value === user.id;
    const nextRole = user.role === 'superadmin' ? 'member' : 'superadmin';

    return h('div', { class: 'flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end' }, [
        user.is_active
            ? h(
                  AppButton,
                  { variant: 'secondary', size: 'sm', isDisabled: isSaving, onClick: () => askChange(user, 'deactivate') },
                  () => [h(UserX, { class: 'size-4', 'aria-hidden': 'true' }), 'Nonaktifkan'],
              )
            : h(
                  AppButton,
                  { size: 'sm', isLoading: isSaving, onClick: () => setActivation(user, true) },
                  () => [isSaving ? null : h(UserCheck, { class: 'size-4', 'aria-hidden': 'true' }), 'Aktifkan'],
              ),
        h('div', { class: 'flex flex-col items-end sm:items-start' }, [
            h(
                'button',
                {
                    type: 'button',
                    class: 'cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-800 disabled:opacity-60',
                    disabled: isSaving,
                    'aria-label': `Jadikan ${user.email} ${roleLabel(nextRole)}`,
                    onClick: () => askChange(user, 'role'),
                },
                `Jadikan ${roleLabel(nextRole).toLowerCase()}`,
            ),
            user.has_two_factor
                ? h(
                      'button',
                      {
                          type: 'button',
                          class: 'inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-500 hover:bg-danger-50 hover:text-danger-700 disabled:opacity-60',
                          disabled: isSaving,
                          'aria-label': `Reset 2FA ${user.email}`,
                          onClick: () => askChange(user, 'reset-two-factor'),
                      },
                      [h(KeyRound, { class: 'size-3.5', 'aria-hidden': 'true' }), 'Reset 2FA'],
                  )
                : null,
        ]),
    ]);
}

const table = useTable({ features: tableFeatures({}), columns, data: users });

const confirmText = computed(() => {
    const change = pendingChange.value;

    if (change === null) {
        return { title: '', description: '', confirmLabel: '' };
    }

    if (change.kind === 'deactivate') {
        return {
            title: 'Nonaktifkan akun ini?',
            description: `${change.user.email} langsung keluar dari panel dan tidak bisa masuk sampai diaktifkan lagi. Link miliknya tetap tampil di pencarian.`,
            confirmLabel: 'Ya, nonaktifkan',
        };
    }

    if (change.kind === 'reset-two-factor') {
        return {
            title: 'Reset 2FA akun ini?',
            description: `Kunci authenticator dan recovery code ${change.user.email} langsung tidak berlaku. Saat 2FA diwajibkan, ia diminta memindai QR baru ketika masuk berikutnya. Pakai ini bila ponselnya hilang atau ganti.`,
            confirmLabel: 'Ya, reset 2FA',
        };
    }

    const isPromoting = change.user.role !== 'superadmin';

    return {
        title: isPromoting ? 'Jadikan superadmin?' : 'Turunkan menjadi member?',
        description: isPromoting
            ? `${change.user.email} akan bisa mengaktifkan akun, mengubah peran, dan mengatur 2FA untuk semua pengguna.`
            : `${change.user.email} tidak lagi bisa mengelola pengguna dan pengaturan keamanan.`,
        confirmLabel: isPromoting ? 'Ya, jadikan superadmin' : 'Ya, jadikan member',
    };
});

async function loadUsers(page = pagination.value.page) {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    errorMessage.value = '';

    try {
        const response = await http.get('/users', {
            params: {
                page,
                per_page: PER_PAGE,
                q: searchText.value.trim() || undefined,
                status: statusFilter.value || undefined,
            },
        });

        // Jawaban dari filter sebelumnya yang datang terlambat diabaikan.
        if (requestId !== latestRequestId) {
            return;
        }

        users.value = response.data.data.items;
        pagination.value = response.data.data.pagination;
        pendingCount.value = response.data.data.pending_count;
    } catch (error) {
        if (requestId === latestRequestId) {
            errorMessage.value = getErrorMessage(error);
        }
    } finally {
        if (requestId === latestRequestId) {
            isLoading.value = false;
            hasLoadedOnce.value = true;
        }
    }
}

const searchUsers = debounce(() => loadUsers(1), SEARCH_DELAY_MS);

watch(searchText, searchUsers);
watch(statusFilter, () => loadUsers(1));
onBeforeUnmount(() => searchUsers.cancel());

function clearFilters() {
    searchText.value = '';
    statusFilter.value = '';
    searchUsers.cancel();
    loadUsers(1);
}

function replaceUser(updatedUser) {
    users.value = users.value.map((user) => (user.id === updatedUser.id ? updatedUser : user));
}

async function setActivation(user, isActive) {
    savingUserId.value = user.id;

    try {
        const response = await http.put(`/users/${user.id}/activation`, { is_active: isActive });
        replaceUser(response.data.data);
        pendingCount.value = Math.max(0, pendingCount.value + (isActive ? -1 : 1));
        toast.success(response.data.message, user.email);
    } catch (error) {
        toast.error('Status akun gagal diubah', getErrorMessage(error));
    } finally {
        savingUserId.value = null;
    }
}

async function changeRole(user) {
    savingUserId.value = user.id;

    try {
        const response = await http.put(`/users/${user.id}/role`, { role: user.role === 'superadmin' ? 'member' : 'superadmin' });
        replaceUser(response.data.data);
        toast.success(response.data.message, `${user.email} sekarang ${roleLabel(response.data.data.role).toLowerCase()}.`);
    } catch (error) {
        toast.error('Peran gagal diubah', getErrorMessage(error));
    } finally {
        savingUserId.value = null;
    }
}

async function resetTwoFactor(user) {
    savingUserId.value = user.id;

    try {
        const response = await http.delete(`/users/${user.id}/two-factor`);
        replaceUser(response.data.data);
        toast.success(response.data.message, `${user.email} akan diminta memasang 2FA lagi.`);
    } catch (error) {
        toast.error('2FA gagal direset', getErrorMessage(error));
    } finally {
        savingUserId.value = null;
    }
}

function askChange(user, kind) {
    pendingChange.value = { user, kind };
    isConfirmOpen.value = true;
}

async function confirmChange() {
    const { user, kind } = pendingChange.value;

    if (kind === 'deactivate') {
        await setActivation(user, false);
    } else if (kind === 'reset-two-factor') {
        await resetTwoFactor(user);
    } else {
        await changeRole(user);
    }

    isConfirmOpen.value = false;
}

onMounted(() => loadUsers(1));
</script>

<template>
    <div>
        <section class="relative isolate overflow-hidden bg-hero" aria-labelledby="users-heading">
            <div class="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" aria-hidden="true" />
            <div class="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-14">
                <h1 id="users-heading" class="font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">Pengguna</h1>
                <p class="mt-2 max-w-2xl text-ink-400">
                    Akun dibuat otomatis saat seseorang masuk pertama kali lewat Account Center. Aktifkan akun yang Anda kenal
                    agar pemiliknya bisa mengelola link di CekCari.
                </p>
                <button
                    v-if="pendingCount > 0"
                    type="button"
                    class="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-400/40 bg-brand-400/10 px-4 py-2 text-sm text-brand-200 transition-colors hover:bg-brand-400/20"
                    @click="statusFilter = 'pending'"
                >
                    <span class="font-mono font-semibold text-brand-100">{{ pendingCount }}</span>
                    akun menunggu aktivasi
                </button>
            </div>
        </section>

        <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="relative w-full sm:max-w-sm">
                    <label for="user-search" class="sr-only">Cari nama atau email</label>
                    <Search class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <input
                        id="user-search"
                        v-model="searchText"
                        type="text"
                        enterkeyhint="search"
                        autocomplete="off"
                        placeholder="Cari nama atau email…"
                        class="h-11 w-full rounded-full border border-ink-200 bg-surface pr-11 pl-11 text-base text-ink-900 shadow-card transition-colors placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none sm:text-sm"
                    />
                    <button
                        v-if="searchText"
                        type="button"
                        class="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        aria-label="Hapus pencarian"
                        @click="searchText = ''"
                    >
                        <X class="size-4" />
                    </button>
                </div>

                <div class="flex rounded-full border border-ink-200 bg-surface p-1 shadow-card" role="group" aria-label="Saring status akun">
                    <button
                        v-for="filter in STATUS_FILTERS"
                        :key="filter.value"
                        type="button"
                        class="h-9 flex-1 cursor-pointer rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors sm:flex-none"
                        :class="statusFilter === filter.value ? 'bg-ink-900 text-ink-50' : 'text-ink-600 hover:bg-ink-100'"
                        :aria-pressed="statusFilter === filter.value"
                        @click="statusFilter = filter.value"
                    >
                        {{ filter.label }}
                    </button>
                </div>
            </div>

            <div
                v-if="!hasLoadedOnce"
                class="divide-y divide-ink-200/80 rounded-3xl border border-ink-200/70 bg-surface"
                aria-busy="true"
                aria-label="Memuat pengguna"
            >
                <div v-for="placeholder in 3" :key="placeholder" class="flex animate-pulse items-center gap-3 p-5">
                    <div class="size-9 rounded-full bg-ink-100" />
                    <div class="flex flex-1 flex-col gap-2">
                        <div class="h-4 w-40 rounded bg-ink-100" />
                        <div class="h-3 w-56 rounded bg-ink-100" />
                    </div>
                </div>
            </div>

            <div v-else-if="errorMessage" class="rounded-3xl border border-ink-200/70 bg-surface">
                <EmptyState :icon="CircleAlert" title="Daftar pengguna gagal dimuat" :description="errorMessage">
                    <AppButton variant="secondary" @click="loadUsers()">Muat ulang daftar</AppButton>
                </EmptyState>
            </div>

            <div v-else-if="users.length === 0 && hasActiveFilter" class="rounded-3xl border border-ink-200/70 bg-surface">
                <EmptyState :icon="SearchX" title="Tidak ada akun yang cocok" description="Coba kata lain atau tampilkan semua status.">
                    <AppButton variant="secondary" @click="clearFilters">Tampilkan semua akun</AppButton>
                </EmptyState>
            </div>

            <div v-else-if="users.length === 0" class="rounded-3xl border border-dashed border-ink-300 bg-surface/60">
                <EmptyState :icon="Users" title="Belum ada pengguna" description="Akun muncul di sini setelah pemiliknya masuk pertama kali." />
            </div>

            <div
                v-else
                class="overflow-hidden rounded-3xl border border-ink-200/70 bg-surface shadow-card transition-opacity"
                :class="{ 'opacity-60': isLoading }"
                :aria-busy="isLoading"
            >
                <table class="w-full table-fixed text-left">
                    <thead class="border-b border-ink-200/70 text-xs tracking-wider text-ink-400 uppercase">
                        <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
                            <th
                                v-for="header in headerGroup.headers"
                                :key="header.id"
                                scope="col"
                                class="px-5 py-3.5 font-medium"
                                :class="COLUMN_CLASSES[header.column.id]"
                            >
                                <FlexRender v-if="!header.isPlaceholder" :header="header" />
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-ink-200/70">
                        <tr
                            v-for="row in table.getRowModel().rows"
                            :key="row.id"
                            class="transition-colors"
                            :class="row.original.is_active ? 'hover:bg-brand-50/50' : 'bg-warning-50/40'"
                        >
                            <td
                                v-for="cell in row.getAllCells()"
                                :key="cell.id"
                                class="px-5 py-4 align-middle"
                                :class="COLUMN_CLASSES[cell.column.id]"
                            >
                                <FlexRender :cell="cell" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div v-if="pagination.last_page > 1" class="mt-8">
                <AppPagination
                    :page="pagination.page"
                    :total="pagination.total"
                    :per-page="pagination.per_page"
                    @update:page="loadUsers"
                />
            </div>

            <p class="mt-6 flex items-center gap-2 text-sm text-ink-500">
                <ShieldCheck class="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span>
                    Kewajiban 2FA untuk semua akun diatur di menu
                    <RouterLink :to="{ name: 'security' }" class="font-medium text-brand-700 hover:underline">Keamanan</RouterLink
                    >.
                </span>
            </p>
        </div>

        <ConfirmDialog
            v-model:open="isConfirmOpen"
            :title="confirmText.title"
            :description="confirmText.description"
            :confirm-label="confirmText.confirmLabel"
            :is-processing="savingUserId !== null"
            @confirm="confirmChange"
        />
    </div>
</template>
