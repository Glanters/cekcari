<script setup>
import { h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import dayjs from 'dayjs';
import { FlexRender, tableFeatures, useTable } from '@tanstack/vue-table';
import { CircleAlert, Globe, Pencil, Search, SearchX, Trash2, X } from 'lucide-vue-next';
import AddDomainBar from '@/components/AddDomainBar.vue';
import AppButton from '@/components/AppButton.vue';
import AppPagination from '@/components/AppPagination.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import DomainQuickEditDialog from '@/components/DomainQuickEditDialog.vue';
import DomainAvatar from '@/components/DomainAvatar.vue';
import EmptyState from '@/components/EmptyState.vue';
import SiteAddress from '@/components/SiteAddress.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import http from '@/lib/http';
import { getErrorMessage } from '@/lib/apiErrors';
import { debounce } from '@/lib/debounce';
import { hostOf } from '@/lib/siteAddress';
import { useToast } from '@/composables/useToast';

const PER_PAGE = 10;
const SEARCH_DELAY_MS = 300;

// Lebar kolom tetap (table-fixed) supaya judul panjang terpotong rapi, bukan mendorong kolom lain keluar layar.
// Kolom sekunder disembunyikan di layar kecil; status tetap tampil di dalam kolom "Situs".
const COLUMN_CLASSES = {
    site: '',
    status: 'hidden w-48 sm:table-cell',
    pages: 'hidden w-24 text-right md:table-cell',
    lastCrawledAt: 'hidden w-40 lg:table-cell',
    actions: 'w-28 text-right',
};

const toast = useToast();
const domains = ref([]);
const pagination = ref({ page: 1, per_page: PER_PAGE, total: 0, last_page: 1 });
const isLoading = ref(true);
const hasLoadedOnce = ref(false);
const errorMessage = ref('');
const searchText = ref('');
const activeKeyword = ref('');
const registeredCount = ref(0);
const editingDomain = ref(null);
const isEditDialogOpen = ref(false);
let latestRequestId = 0;
const domainPendingDeletion = ref(null);
const isDeleteDialogOpen = ref(false);
const isDeleting = ref(false);

function lastUpdatedLabel(domain) {
    return domain.last_crawled_at ? dayjs(domain.last_crawled_at).fromNow() : 'Belum pernah';
}

const columns = [
    {
        id: 'site',
        header: 'Situs',
        cell: ({ row }) =>
            h('div', { class: 'flex min-w-0 items-center gap-3.5' }, [
                h(DomainAvatar, { logoUrl: row.original.logo_url, name: row.original.title }),
                h('div', { class: 'min-w-0' }, [
                    h('div', { class: 'flex min-w-0 items-center gap-2' }, [
                        h(
                            RouterLink,
                            {
                                to: { name: 'domains.show', params: { id: row.original.id } },
                                class: 'truncate font-medium text-ink-900 after:absolute after:inset-0 hover:text-brand-700',
                            },
                            () => row.original.title,
                        ),
                        row.original.is_promoted
                            ? h(
                                  'span',
                                  { class: 'shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800' },
                                  'Promosi',
                              )
                            : null,
                    ]),
                    h('p', { class: 'truncate text-xs' }, h(SiteAddress, { url: row.original.url })),
                    h('div', { class: 'mt-1.5 sm:hidden' }, h(StatusBadge, { status: row.original.crawl_status })),
                ]),
            ]),
    },
    {
        id: 'status',
        header: 'Status',
        cell: ({ row }) =>
            h('div', { class: 'flex flex-col items-start gap-1' }, [
                h(StatusBadge, { status: row.original.crawl_status }),
                row.original.redirected_to
                    ? h('span', { class: 'max-w-40 truncate font-mono text-xs text-ink-500' }, `ke ${hostOf(row.original.redirected_to)}`)
                    : null,
            ]),
    },
    {
        id: 'pages',
        header: 'Halaman',
        cell: ({ row }) => h('span', { class: 'font-mono text-sm text-ink-700' }, row.original.pages_count),
    },
    {
        id: 'lastCrawledAt',
        header: 'Diperbarui',
        cell: ({ row }) => h('span', { class: 'text-sm whitespace-nowrap text-ink-500' }, lastUpdatedLabel(row.original)),
    },
    {
        id: 'actions',
        header: () => h('span', { class: 'sr-only' }, 'Aksi'),
        cell: ({ row }) =>
            h('div', { class: 'relative z-10 flex items-center justify-end gap-1' }, [
                h(
                    'button',
                    {
                        type: 'button',
                        class: 'grid size-10 cursor-pointer place-items-center rounded-full text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700',
                        'aria-label': `Edit ${row.original.url}`,
                        title: 'Edit cepat',
                        onClick: () => openQuickEdit(row.original),
                    },
                    h(Pencil, { class: 'size-4', 'aria-hidden': 'true' }),
                ),
                h(
                    'button',
                    {
                        type: 'button',
                        class: 'grid size-10 cursor-pointer place-items-center rounded-full text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600',
                        'aria-label': `Hapus ${row.original.url}`,
                        title: 'Hapus',
                        onClick: () => askDelete(row.original),
                    },
                    h(Trash2, { class: 'size-4', 'aria-hidden': 'true' }),
                ),
            ]),
    },
];

const table = useTable({ features: tableFeatures({}), columns, data: domains });

async function loadDomains(page = pagination.value.page) {
    const requestId = ++latestRequestId;
    const keyword = searchText.value.trim();
    isLoading.value = true;
    errorMessage.value = '';

    try {
        const response = await http.get('/domains', {
            params: { page, per_page: PER_PAGE, q: keyword || undefined },
        });

        // Jawaban dari ketikan sebelumnya yang datang terlambat diabaikan.
        if (requestId !== latestRequestId) {
            return;
        }

        domains.value = response.data.data.items;
        pagination.value = response.data.data.pagination;
        activeKeyword.value = keyword;

        if (keyword === '') {
            registeredCount.value = pagination.value.total;
        }
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

const searchDomains = debounce(() => loadDomains(1), SEARCH_DELAY_MS);

watch(searchText, searchDomains);
onBeforeUnmount(() => searchDomains.cancel());

function clearSearch() {
    searchText.value = '';
    searchDomains.cancel();
    loadDomains(1);
}

function openQuickEdit(domain) {
    editingDomain.value = domain;
    isEditDialogOpen.value = true;
}

// Data dari dialog edit langsung menggantikan baris di tabel, tanpa memuat ulang seluruh daftar.
function applyDomainUpdate(updatedDomain) {
    editingDomain.value = updatedDomain;
    domains.value = domains.value.map((domain) => (domain.id === updatedDomain.id ? updatedDomain : domain));
}

async function handleBatchFinished({ addedCount, totalCount }) {
    if (addedCount === totalCount) {
        toast.success(`${addedCount} situs ditambahkan`, 'Semua sudah tampil di pencarian CekCari.');
    } else if (addedCount > 0) {
        toast.info(`${addedCount} dari ${totalCount} situs ditambahkan`, 'Lihat alasan situs yang gagal di daftar hasil.');
    } else {
        toast.error('Tidak ada situs yang ditambahkan', 'Lihat alasannya di daftar hasil.');
    }

    if (addedCount > 0) {
        await loadDomains(1);
    }
}

function askDelete(domain) {
    domainPendingDeletion.value = domain;
    isDeleteDialogOpen.value = true;
}

async function deleteDomain() {
    isDeleting.value = true;

    try {
        await http.delete(`/domains/${domainPendingDeletion.value.id}`);
        toast.success('Domain dihapus', `${domainPendingDeletion.value.host} tidak lagi tampil di pencarian.`);
        isDeleteDialogOpen.value = false;
        const isLastItemOnPage = domains.value.length === 1 && pagination.value.page > 1;
        await loadDomains(isLastItemOnPage ? pagination.value.page - 1 : pagination.value.page);
    } catch (error) {
        toast.error('Gagal menghapus domain', getErrorMessage(error));
    } finally {
        isDeleting.value = false;
    }
}

onMounted(() => loadDomains(1));
</script>

<template>
    <div>
        <section class="relative isolate overflow-hidden bg-hero" aria-labelledby="domains-heading">
            <div class="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" aria-hidden="true" />
            <div class="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-16">
                <h1 id="domains-heading" class="font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
                    Domain saya
                </h1>
                <p class="mt-2 text-ink-400">
                    <template v-if="hasLoadedOnce && !errorMessage">
                        <span class="font-mono text-brand-300">{{ registeredCount }}</span>
                        situs terdaftar di CekCari.
                    </template>
                    Tambahkan satu atau beberapa situs sekaligus.
                </p>
                <div class="mt-7 max-w-2xl">
                    <AddDomainBar @finished="handleBatchFinished" />
                </div>
            </div>
        </section>

        <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <div v-if="registeredCount > 0 || activeKeyword" class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="relative w-full sm:max-w-sm">
                    <label for="domain-search" class="sr-only">Cari link Anda</label>
                    <Search class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <input
                        id="domain-search"
                        v-model="searchText"
                        type="text"
                        enterkeyhint="search"
                        autocomplete="off"
                        placeholder="Cari judul atau link…"
                        class="h-11 w-full rounded-full border border-ink-200 bg-surface pr-11 pl-11 text-base text-ink-900 shadow-card transition-colors placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none sm:text-sm"
                    />
                    <button
                        v-if="searchText"
                        type="button"
                        class="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        aria-label="Hapus pencarian"
                        @click="clearSearch"
                    >
                        <X class="size-4" />
                    </button>
                </div>
                <p class="text-sm text-ink-500" aria-live="polite">
                    <template v-if="activeKeyword">
                        <span class="font-mono font-medium text-ink-800">{{ pagination.total }}</span> link cocok dengan
                        “{{ activeKeyword }}”
                    </template>
                    <template v-else-if="hasLoadedOnce">
                        Menampilkan {{ domains.length }} dari
                        <span class="font-mono font-medium text-ink-800">{{ pagination.total }}</span> link
                    </template>
                </p>
            </div>

            <div
                v-if="!hasLoadedOnce"
                class="divide-y divide-ink-200/80 rounded-3xl border border-ink-200/70 bg-surface"
                aria-busy="true"
                aria-label="Memuat domain"
            >
                <div v-for="placeholder in 3" :key="placeholder" class="flex animate-pulse items-center gap-3.5 p-5">
                    <div class="size-9 rounded-lg bg-ink-100" />
                    <div class="flex flex-1 flex-col gap-2">
                        <div class="h-4 w-48 rounded bg-ink-100" />
                        <div class="h-3 w-32 rounded bg-ink-100" />
                    </div>
                </div>
            </div>

            <div v-else-if="errorMessage" class="rounded-3xl border border-ink-200/70 bg-surface">
                <EmptyState :icon="CircleAlert" title="Daftar domain gagal dimuat" :description="errorMessage">
                    <AppButton variant="secondary" @click="loadDomains()">Muat ulang daftar</AppButton>
                </EmptyState>
            </div>

            <div v-else-if="domains.length === 0 && activeKeyword" class="rounded-3xl border border-ink-200/70 bg-surface">
                <EmptyState
                    :icon="SearchX"
                    :title="`Tidak ada link yang cocok dengan “${activeKeyword}”`"
                    description="Coba kata lain dari judul atau alamat link, misalnya nama domainnya."
                >
                    <AppButton variant="secondary" @click="clearSearch">Hapus pencarian</AppButton>
                </EmptyState>
            </div>

            <div v-else-if="domains.length === 0" class="rounded-3xl border border-dashed border-ink-300 bg-surface/60">
                <EmptyState
                    :icon="Globe"
                    title="Belum ada domain"
                    description="Tulis alamat situs Anda di kolom di atas, misalnya psms.com. Situs langsung tampil di pencarian CekCari."
                />
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
                            class="relative transition-colors hover:bg-brand-50/50"
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
                    @update:page="loadDomains"
                />
            </div>
        </div>

        <DomainQuickEditDialog v-model:open="isEditDialogOpen" :domain="editingDomain" @updated="applyDomainUpdate" />

        <ConfirmDialog
            v-model:open="isDeleteDialogOpen"
            title="Hapus domain ini?"
            :description="`${domainPendingDeletion?.url ?? ''} akan dihapus dari daftar Anda dan tidak lagi tampil di hasil pencarian.`"
            :is-processing="isDeleting"
            @confirm="deleteDomain"
        />
    </div>
</template>
