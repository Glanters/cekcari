<script setup>
import { computed, h, onMounted, ref, watch } from 'vue';
import { FlexRender, tableFeatures, useTable } from '@tanstack/vue-table';
import { BarChart3, CircleAlert, Globe } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppPagination from '@/components/AppPagination.vue';
import DomainAvatar from '@/components/DomainAvatar.vue';
import EmptyState from '@/components/EmptyState.vue';
import SiteAddress from '@/components/SiteAddress.vue';
import http from '@/lib/http';
import { getErrorMessage } from '@/lib/apiErrors';

const PER_PAGE = 20;

const RANGES = [
    { value: 'today', label: 'Hari ini' },
    { value: '7d', label: '7 hari' },
    { value: '30d', label: '30 hari' },
    { value: 'all', label: 'Semua' },
];

const COLUMN_CLASSES = {
    site: '',
    owner: 'hidden w-56 lg:table-cell',
    clicks: 'w-24 text-right',
    uniqueClicks: 'hidden w-36 text-right sm:table-cell',
};

const range = ref('7d');
const summary = ref(null);
const domains = ref([]);
const pagination = ref({ page: 1, per_page: PER_PAGE, total: 0, last_page: 1 });
const isLoading = ref(true);
const errorMessage = ref('');
let latestRequestId = 0;

const canViewAll = computed(() => summary.value?.can_view_all === true);

const formatNumber = (value) => Number(value ?? 0).toLocaleString('id-ID');

const columns = [
    {
        id: 'site',
        header: 'Situs',
        cell: ({ row }) =>
            h('div', { class: 'flex min-w-0 items-center gap-3' }, [
                h(DomainAvatar, { logoUrl: row.original.logo_url, name: row.original.title }),
                h('div', { class: 'min-w-0' }, [
                    h('p', { class: 'truncate font-medium text-ink-900' }, row.original.title),
                    h('p', { class: 'truncate text-xs' }, h(SiteAddress, { url: row.original.url })),
                    canViewAll.value
                        ? h('p', { class: 'mt-0.5 truncate text-xs text-ink-500 lg:hidden' }, `Milik ${row.original.owner.name}`)
                        : null,
                ]),
            ]),
    },
    {
        id: 'owner',
        header: 'Pemilik',
        cell: ({ row }) =>
            h('div', { class: 'min-w-0' }, [
                h('p', { class: 'truncate text-sm text-ink-800' }, row.original.owner.name),
                h('p', { class: 'truncate font-mono text-xs text-ink-500' }, row.original.owner.email),
            ]),
    },
    {
        id: 'clicks',
        header: 'Klik',
        cell: ({ row }) => h('span', { class: 'font-mono text-sm font-semibold text-ink-900' }, formatNumber(row.original.clicks)),
    },
    {
        id: 'uniqueClicks',
        header: 'Pengunjung',
        cell: ({ row }) => h('span', { class: 'font-mono text-sm text-ink-600' }, formatNumber(row.original.unique_clicks)),
    },
];

// Kolom pemilik hanya berarti bagi superadmin yang melihat situs semua member.
const visibleColumns = computed(() => (canViewAll.value ? columns : columns.filter((column) => column.id !== 'owner')));

const table = useTable({
    features: tableFeatures({}),
    get columns() {
        return visibleColumns.value;
    },
    data: domains,
});

const statCards = computed(() => {
    if (!summary.value) {
        return [];
    }

    const clickCards = [
        { label: 'Klik ke situs', value: summary.value.clicks.total, hint: 'Semua klik dari hasil pencarian' },
        { label: 'Pengunjung yang mengklik', value: summary.value.clicks.unique, hint: 'Dihitung sekali per pengunjung' },
    ];

    if (!canViewAll.value) {
        return clickCards;
    }

    return [
        { label: 'Pengunjung', value: summary.value.visitors.unique, hint: 'Browser berbeda yang membuka CekCari' },
        { label: 'Kunjungan', value: summary.value.visitors.visits, hint: 'Jumlah halaman pencarian yang dibuka' },
        ...clickCards,
    ];
});

async function loadStatistics(page = pagination.value.page) {
    const requestId = ++latestRequestId;
    isLoading.value = true;
    errorMessage.value = '';

    try {
        const response = await http.get('/statistics', { params: { range: range.value, page, per_page: PER_PAGE } });

        // Jawaban dari rentang sebelumnya yang datang terlambat diabaikan.
        if (requestId !== latestRequestId) {
            return;
        }

        const { items, pagination: nextPagination, ...rest } = response.data.data;
        summary.value = rest;
        domains.value = items;
        pagination.value = nextPagination;
    } catch (error) {
        if (requestId === latestRequestId) {
            errorMessage.value = getErrorMessage(error);
        }
    } finally {
        if (requestId === latestRequestId) {
            isLoading.value = false;
        }
    }
}

watch(range, () => loadStatistics(1));
onMounted(() => loadStatistics(1));
</script>

<template>
    <div>
        <section class="relative isolate overflow-hidden bg-hero" aria-labelledby="statistics-heading">
            <div class="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" aria-hidden="true" />
            <div class="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-14">
                <h1 id="statistics-heading" class="font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
                    Statistik
                </h1>
                <p class="mt-2 max-w-2xl text-ink-400">
                    <template v-if="canViewAll">Pengunjung CekCari dan klik ke setiap situs dari hasil pencarian.</template>
                    <template v-else>Klik ke situs Anda dari hasil pencarian CekCari.</template>
                </p>

                <div
                    class="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 p-1"
                    role="group"
                    aria-label="Rentang waktu"
                >
                    <button
                        v-for="option in RANGES"
                        :key="option.value"
                        type="button"
                        class="h-9 cursor-pointer rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors"
                        :class="range === option.value ? 'bg-brand-400 text-ink-950' : 'text-ink-300 hover:bg-white/10'"
                        :aria-pressed="range === option.value"
                        @click="range = option.value"
                    >
                        {{ option.label }}
                    </button>
                </div>
            </div>
        </section>

        <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <div v-if="errorMessage" class="rounded-3xl border border-ink-200/70 bg-surface">
                <EmptyState :icon="CircleAlert" title="Statistik gagal dimuat" :description="errorMessage">
                    <AppButton variant="secondary" @click="loadStatistics()">Muat ulang</AppButton>
                </EmptyState>
            </div>

            <template v-else>
                <div
                    class="grid grid-cols-2 gap-3 sm:gap-4"
                    :class="statCards.length > 2 ? 'lg:grid-cols-4' : ''"
                    :aria-busy="isLoading"
                >
                    <template v-if="summary">
                        <div
                            v-for="card in statCards"
                            :key="card.label"
                            class="rounded-3xl border border-ink-200/70 bg-surface p-5 shadow-card transition-opacity"
                            :class="{ 'opacity-60': isLoading }"
                        >
                            <p class="text-sm text-ink-500">{{ card.label }}</p>
                            <p class="mt-1 font-display text-3xl font-semibold tracking-tight text-ink-950">
                                {{ formatNumber(card.value) }}
                            </p>
                            <p class="mt-1 text-xs text-ink-400">{{ card.hint }}</p>
                        </div>
                    </template>
                    <template v-else>
                        <div v-for="placeholder in 2" :key="placeholder" class="h-28 animate-pulse rounded-3xl bg-ink-100" />
                    </template>
                </div>

                <h2 class="mt-10 flex items-center gap-2 font-display text-lg font-semibold text-ink-900">
                    <BarChart3 class="size-5 text-brand-600" aria-hidden="true" />
                    Klik per situs
                </h2>

                <div
                    v-if="summary && domains.length === 0"
                    class="mt-4 rounded-3xl border border-dashed border-ink-300 bg-surface/60"
                >
                    <EmptyState :icon="Globe" title="Belum ada situs" description="Klik akan tercatat setelah situs ditambahkan dan muncul di hasil pencarian." />
                </div>

                <div
                    v-else-if="summary"
                    class="mt-4 overflow-hidden rounded-3xl border border-ink-200/70 bg-surface shadow-card transition-opacity"
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
                            <tr v-for="row in table.getRowModel().rows" :key="row.id">
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
                        @update:page="loadStatistics"
                    />
                </div>

                <p class="mt-6 text-xs text-ink-400">
                    Pengunjung dihitung per browser tanpa data pribadi. Bot mesin pencari umumnya tidak ikut terhitung.
                </p>
            </template>
        </div>
    </div>
</template>
