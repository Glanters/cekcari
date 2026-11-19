<script setup>
import { computed, ref } from 'vue';
import dayjs from 'dayjs';
import { RefreshCw } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import http from '@/lib/http';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { useToast } from '@/composables/useToast';
import { hostOf } from '@/lib/siteAddress';

const props = defineProps({
    domain: { type: Object, required: true },
});

const emit = defineEmits(['updated']);

const toast = useToast();
const isRequestingCrawl = ref(false);

const redirectHost = computed(() => (props.domain.redirected_to ? hostOf(props.domain.redirected_to) : ''));

const isCrawlInProgress = computed(() => ['pending', 'crawling'].includes(props.domain.crawl_status));

async function requestCrawl() {
    isRequestingCrawl.value = true;

    try {
        const response = await http.post(`/domains/${props.domain.id}/crawls`);
        emit('updated', response.data.data);
        toast.success('Pembaruan data dijadwalkan');
    } catch (error) {
        toast.error('Pembaruan data gagal dijadwalkan', getFieldErrors(error).crawl ?? getErrorMessage(error));
    } finally {
        isRequestingCrawl.value = false;
    }
}
</script>

<template>
    <section class="rounded-3xl border border-ink-200/70 bg-surface p-6 shadow-card" aria-labelledby="summary-heading">
        <h2 id="summary-heading" class="font-display text-lg font-semibold text-ink-900">Ringkasan</h2>

        <dl class="mt-4 divide-y divide-ink-200/70 text-sm">
            <div class="flex items-center justify-between gap-4 py-3">
                <dt class="text-ink-500">Status</dt>
                <dd><StatusBadge :status="domain.crawl_status" /></dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
                <dt class="text-ink-500">Halaman terbaca</dt>
                <dd class="font-mono font-medium text-ink-900">{{ domain.pages_count }}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
                <dt class="text-ink-500">Terakhir diperbarui</dt>
                <dd class="text-ink-900">
                    {{ domain.last_crawled_at ? dayjs(domain.last_crawled_at).fromNow() : 'Belum pernah' }}
                </dd>
            </div>
            <div class="flex items-center justify-between gap-4 py-3">
                <dt class="text-ink-500">Didaftarkan</dt>
                <dd class="text-ink-900">{{ dayjs(domain.created_at).format('D MMMM YYYY') }}</dd>
            </div>
        </dl>

        <div v-if="domain.crawl_status === 'redirected'" class="mt-2 rounded-2xl bg-warning-50 p-3 text-sm text-warning-700">
            <p>
                Link ini mengalihkan pengunjung ke
                <span class="font-mono font-medium break-all">{{ redirectHost }}</span>, domain yang berbeda.
            </p>
            <p class="mt-1.5">
                Crawler hanya membaca halaman di situs yang Anda daftarkan, jadi isi halaman tujuan tidak diindeks.
                Judul dan deskripsinya tetap tampil di pencarian. Bila situs tujuan milik Anda, daftarkan alamat itu
                langsung.
            </p>
        </div>
        <p v-else-if="domain.crawl_status === 'failed'" class="mt-2 rounded-2xl bg-danger-50 p-3 text-sm text-danger-700">
            Situs tidak dapat dibaca. Pastikan situs aktif dan tidak memblokir bot, lalu perbarui lagi.
        </p>
        <p v-else class="mt-2 text-sm text-ink-500">
            Data situs diperbarui otomatis setiap minggu. Deskripsi dan tag yang Anda atur sendiri tidak ditimpa.
        </p>

        <AppButton
            variant="secondary"
            class="mt-5 w-full"
            :is-loading="isRequestingCrawl"
            :is-disabled="isCrawlInProgress"
            @click="requestCrawl"
        >
            <RefreshCw
                v-if="!isRequestingCrawl"
                class="size-4"
                :class="{ 'motion-safe:animate-spin': isCrawlInProgress }"
                aria-hidden="true"
            />
            {{ isCrawlInProgress ? 'Sedang membaca situs…' : 'Perbarui data sekarang' }}
        </AppButton>
    </section>
</template>
