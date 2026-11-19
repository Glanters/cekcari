<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { CircleAlert, RotateCw, SearchX, Sparkles } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppLogo from '@/components/AppLogo.vue';
import InstallAppPrompt from '@/components/InstallAppPrompt.vue';
import AppPagination from '@/components/AppPagination.vue';
import ResultCard from '@/components/ResultCard.vue';
import SearchBox from '@/components/SearchBox.vue';
import http from '@/lib/http';
import { getErrorMessage } from '@/lib/apiErrors';
import { getVisitorSeed } from '@/lib/visitorSeed';

const PER_PAGE = 10;

const route = useRoute();
const router = useRouter();

const query = ref('');
const results = ref([]);
const pagination = ref({ page: 1, per_page: PER_PAGE, total: 0, last_page: 1 });
const markers = ref({ start: '', end: '' });
const promoted = ref(null);
const isFuzzy = ref(false);
const correctedQuery = ref(null);
const isLoading = ref(false);
const errorMessage = ref('');
let latestRequestId = 0;

const keyword = computed(() => String(route.query.q ?? '').trim());
const currentPage = computed(() => Math.max(1, Number.parseInt(route.query.halaman, 10) || 1));
// "Cari ... saja": pengunjung meminta kata yang diketik apa adanya, tanpa koreksi salah ketik.
const isExact = computed(() => route.query.persis === '1');

async function loadResults() {
    if (keyword.value === '') {
        router.replace({ name: 'home' });

        return;
    }

    const requestId = ++latestRequestId;
    isLoading.value = true;
    errorMessage.value = '';

    try {
        const response = await http.get('/search-results', {
            params: {
                q: keyword.value,
                page: currentPage.value,
                per_page: PER_PAGE,
                seed: getVisitorSeed(window.sessionStorage),
                exact: isExact.value ? true : undefined,
            },
        });

        if (requestId !== latestRequestId) {
            return;
        }

        const payload = response.data.data;
        results.value = payload.items;
        pagination.value = payload.pagination;
        markers.value = payload.highlight;
        promoted.value = payload.promoted;
        isFuzzy.value = payload.is_fuzzy;
        correctedQuery.value = payload.corrected_query;
    } catch (error) {
        if (requestId === latestRequestId) {
            results.value = [];
            promoted.value = null;
            errorMessage.value = getErrorMessage(error);
        }
    } finally {
        if (requestId === latestRequestId) {
            isLoading.value = false;
        }
    }
}

function search(newKeyword) {
    router.push({ name: 'search', query: { q: newKeyword } });
}

function changePage(page) {
    router.push({
        name: 'search',
        query: { q: keyword.value, halaman: page > 1 ? page : undefined, persis: isExact.value ? '1' : undefined },
    });
}

watch(
    () => route.query,
    () => {
        query.value = keyword.value;
        loadResults();
    },
    { immediate: true },
);
</script>

<template>
    <div class="min-h-dvh">
        <header class="sticky top-0 z-20">
            <div class="relative isolate bg-hero">
                <div class="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" aria-hidden="true" />
                <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-8 sm:px-6 sm:py-4">
                    <div class="shrink-0 lg:w-40">
                        <AppLogo tone="light" is-mark-only-on-mobile />
                    </div>
                    <div class="min-w-0 flex-1 sm:max-w-2xl">
                        <SearchBox v-model:query="query" @submit="search" />
                    </div>
                </div>
            </div>
            <div class="h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" aria-hidden="true" />
        </header>

        <!-- Kolom hasil sejajar dengan kolom pencarian di layar lebar (lebar logo + jarak). -->
        <main class="mx-auto max-w-6xl px-4 pt-5 pb-24 sm:px-6 sm:pt-6 lg:pl-54">
            <div class="max-w-2xl">
                <h1 class="sr-only">Hasil pencarian untuk “{{ keyword }}”</h1>

                <div v-if="isLoading" aria-busy="true" aria-label="Memuat hasil">
                    <div class="h-4 w-40 animate-pulse rounded bg-ink-200/70" />
                    <div class="mt-2 divide-y divide-ink-200/80">
                        <div v-for="placeholder in 4" :key="placeholder" class="flex animate-pulse flex-col gap-3 py-7">
                            <div class="flex items-center gap-3">
                                <div class="size-7 rounded-md bg-ink-200/70" />
                                <div class="h-3 w-36 rounded bg-ink-200/70" />
                            </div>
                            <div class="h-6 w-3/4 rounded bg-ink-200/70" />
                            <div class="h-3.5 w-full rounded bg-ink-200/70" />
                            <div class="h-3.5 w-4/5 rounded bg-ink-200/70" />
                        </div>
                    </div>
                </div>

                <div v-else-if="errorMessage" class="py-10" role="alert">
                    <p class="flex items-center gap-2 font-display text-xl font-semibold text-ink-900">
                        <CircleAlert class="size-5 text-danger-600" aria-hidden="true" />
                        Hasil pencarian gagal dimuat
                    </p>
                    <p class="mt-2 text-ink-600">{{ errorMessage }}</p>
                    <AppButton variant="secondary" class="mt-5" @click="loadResults">
                        <RotateCw class="size-4" aria-hidden="true" />
                        Muat ulang hasil
                    </AppButton>
                </div>

                <div v-else-if="results.length === 0 && !promoted" class="py-10">
                    <p class="flex items-center gap-2 font-display text-xl font-semibold text-ink-900">
                        <SearchX class="size-5 text-ink-400" aria-hidden="true" />
                        Belum ada situs untuk “{{ keyword }}”
                    </p>
                    <ul class="mt-3 list-disc space-y-1 pl-5 text-ink-600">
                        <li>Periksa ejaan kata kuncinya.</li>
                        <li>Pakai kata yang lebih umum, misalnya “resep” alih-alih “resep rendang padang”.</li>
                        <li>Cari nama situsnya langsung, misalnya “tokoku”.</li>
                    </ul>
                </div>

                <template v-else>
                    <p class="text-sm text-ink-500" aria-live="polite">
                        <span class="font-mono font-medium text-ink-700">{{ (pagination.total + (promoted ? 1 : 0)).toLocaleString('id-ID') }}</span>
                        situs ditemukan
                        <template v-if="pagination.last_page > 1">
                            · halaman {{ currentPage }} dari {{ pagination.last_page }}
                        </template>
                    </p>

                    <p
                        v-if="correctedQuery"
                        class="mt-5 flex items-start gap-3 border-l-2 border-brand-400 pl-4 text-sm text-ink-700"
                    >
                        <Sparkles class="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <span>
                            Menampilkan hasil untuk
                            <RouterLink
                                :to="{ name: 'search', query: { q: correctedQuery } }"
                                class="font-semibold text-brand-700 underline-offset-4 hover:underline"
                            >
                                {{ correctedQuery }}</RouterLink
                            >.
                            <span class="mt-0.5 block text-ink-500">
                                Cari
                                <RouterLink
                                    :to="{ name: 'search', query: { q: keyword, persis: '1' } }"
                                    class="font-medium text-ink-800 underline-offset-4 hover:underline"
                                >
                                    “{{ keyword }}”</RouterLink
                                >
                                saja
                            </span>
                        </span>
                    </p>

                    <p v-if="isFuzzy" class="mt-5 flex items-start gap-3 border-l-2 border-brand-400 pl-4 text-sm text-ink-700">
                        <Sparkles class="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
                        <span>
                            Tidak ada yang persis cocok dengan “{{ keyword }}”. Ini situs dengan nama yang mirip.
                        </span>
                    </p>

                    <section
                        v-if="promoted && currentPage === 1"
                        class="relative mt-5 rounded-3xl border border-brand-300/70 bg-linear-to-br from-brand-50 to-surface px-5 shadow-card sm:px-7"
                        aria-label="Promosi"
                    >
                        <span
                            class="absolute top-0 right-5 -translate-y-1/2 rounded-full bg-linear-to-br from-brand-300 to-brand-500 px-3 py-1 font-display text-xs font-semibold tracking-wide text-ink-950 shadow-glow sm:right-7"
                        >
                            Promosi
                        </span>
                        <ResultCard :result="promoted" :markers="markers" is-tracked is-promoted />
                    </section>

                    <ol class="mt-1 divide-y divide-ink-200/80" aria-label="Hasil pencarian">
                        <li v-for="(result, index) in results" :key="result.id">
                            <ResultCard
                                :result="result"
                                :markers="markers"
                                :position="(currentPage - 1) * PER_PAGE + index + 1"
                                is-tracked
                            />
                        </li>
                    </ol>

                    <div v-if="pagination.last_page > 1" class="mt-8 border-t border-ink-200/80 pt-8">
                        <AppPagination
                            :page="currentPage"
                            :total="pagination.total"
                            :per-page="pagination.per_page"
                            @update:page="changePage"
                        />
                    </div>
                </template>
            </div>
        </main>
        <InstallAppPrompt />
    </div>
</template>
