<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useForm } from 'vee-validate';
import { ArrowLeft, ArrowUpRight, CircleAlert } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import DomainAvatar from '@/components/DomainAvatar.vue';
import DomainStatusPanel from '@/components/DomainStatusPanel.vue';
import EmptyState from '@/components/EmptyState.vue';
import PromotionToggle from '@/components/PromotionToggle.vue';
import ResultCard from '@/components/ResultCard.vue';
import SiteAddress from '@/components/SiteAddress.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import http from '@/lib/http';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { combine, isRequired, isValidSiteAddress } from '@/lib/validators';
import { useToast } from '@/composables/useToast';

const props = defineProps({
    id: { type: String, required: true },
});

const STATUS_POLL_INTERVAL_MS = 5000;
// Pratinjau memakai baris hasil pencarian yang sama; data panel tidak berisi penanda sorotan.
const NO_HIGHLIGHT_MARKERS = { start: '\u0000', end: '\u0001' };

const toast = useToast();

const domain = ref(null);
const isLoadingDomain = ref(true);
const loadErrorMessage = ref('');
let statusPollTimer = null;

const { defineField, errors, handleSubmit, isSubmitting, resetForm, setErrors, meta } = useForm({
    validationSchema: {
        url: combine(isRequired('Alamat situs'), isValidSiteAddress),
    },
    initialValues: { url: '' },
});

const [url] = defineField('url');

async function loadDomain() {
    isLoadingDomain.value = true;
    loadErrorMessage.value = '';

    try {
        const response = await http.get(`/domains/${props.id}`);
        applyDomainUpdate(response.data.data);
    } catch (error) {
        loadErrorMessage.value = getErrorMessage(error);
    } finally {
        isLoadingDomain.value = false;
    }
}

// Pembacaan situs berjalan di antrean, jadi data domain diperbarui berkala selama prosesnya berlangsung.
async function refreshDomain() {
    try {
        const response = await http.get(`/domains/${props.id}`);
        domain.value = response.data.data;
    } catch (error) {
        stopStatusPolling();
        toast.error('Status gagal diperbarui', getErrorMessage(error));
    }
}

function stopStatusPolling() {
    clearInterval(statusPollTimer);
    statusPollTimer = null;
}

watch(
    () => ['pending', 'crawling'].includes(domain.value?.crawl_status),
    (isCrawlRunning) => {
        if (isCrawlRunning && statusPollTimer === null) {
            statusPollTimer = setInterval(refreshDomain, STATUS_POLL_INTERVAL_MS);
        } else if (!isCrawlRunning) {
            stopStatusPolling();
        }
    },
);

// Perubahan dari panel samping tidak boleh menimpa link yang sedang diketik di formulir.
function applyStatusUpdate(updatedDomain) {
    domain.value = updatedDomain;
}

function applyDomainUpdate(updatedDomain) {
    domain.value = updatedDomain;
    resetForm({ values: { url: updatedDomain.url } });
}

const changeLink = handleSubmit(async (formValues) => {
    try {
        const response = await http.put(`/domains/${props.id}`, { url: formValues.url.trim() });
        applyDomainUpdate(response.data.data);
        toast.success('Link diganti', 'Data situs sudah diambil ulang dari link baru.');
    } catch (error) {
        setErrors(getFieldErrors(error));

        if (error.response?.status !== 422) {
            toast.error('Link gagal diganti', getErrorMessage(error));
        }
    }
});

watch(
    () => props.id,
    () => {
        stopStatusPolling();
        loadDomain();
    },
    { immediate: true },
);

onBeforeUnmount(stopStatusPolling);
</script>

<template>
    <div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <RouterLink
            :to="{ name: 'domains.index' }"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
            <ArrowLeft class="size-4" aria-hidden="true" />
            Domain saya
        </RouterLink>

        <div v-if="isLoadingDomain" class="mt-6 flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Memuat domain">
            <div class="flex items-center gap-4">
                <div class="size-16 rounded-xl bg-ink-200/70" />
                <div class="flex flex-col gap-2">
                    <div class="h-7 w-64 rounded bg-ink-200/70" />
                    <div class="h-4 w-40 rounded bg-ink-200/70" />
                </div>
            </div>
            <div class="h-64 rounded-3xl bg-ink-200/50" />
        </div>

        <div v-else-if="loadErrorMessage" class="mt-6 rounded-3xl border border-ink-200/70 bg-surface">
            <EmptyState :icon="CircleAlert" title="Domain gagal dimuat" :description="loadErrorMessage">
                <AppButton variant="secondary" @click="loadDomain">Muat ulang</AppButton>
            </EmptyState>
        </div>

        <template v-else-if="domain">
            <header class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                <DomainAvatar :logo-url="domain.logo_url" :name="domain.title" size="lg" />
                <div class="min-w-0 flex-1">
                    <h1 class="font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
                        {{ domain.title }}
                    </h1>
                    <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <a
                            :href="domain.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex min-w-0 items-center gap-1 text-sm decoration-brand-300 underline-offset-4 hover:underline"
                        >
                            <SiteAddress :url="domain.url" class="truncate" />
                            <ArrowUpRight class="size-3.5 shrink-0 text-ink-500" aria-hidden="true" />
                            <span class="sr-only">(buka situs di tab baru)</span>
                        </a>
                        <StatusBadge :status="domain.crawl_status" />
                    </div>
                </div>
            </header>

            <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div class="flex flex-col gap-6 lg:col-span-2">
                    <section aria-labelledby="preview-heading">
                        <h2 id="preview-heading" class="text-xs font-medium tracking-wider text-ink-400 uppercase">
                            Tampilan di hasil pencarian CekCari
                        </h2>
                        <div class="mt-3 rounded-3xl border border-ink-200/70 bg-surface px-6 shadow-card sm:px-8">
                            <ResultCard :result="{ ...domain, related_pages: [] }" :markers="NO_HIGHLIGHT_MARKERS" />
                        </div>
                    </section>

                    <form
                        class="rounded-3xl border border-ink-200/70 bg-surface p-6"
                        novalidate
                        aria-labelledby="change-link-heading"
                        @submit="changeLink"
                    >
                        <h2 id="change-link-heading" class="font-display text-lg font-semibold text-ink-900">
                            Ganti link situs
                        </h2>
                        <p class="mt-1 text-sm text-ink-500">
                            Bila situs pindah alamat atau Anda ingin menunjuk halaman lain (mis. psms.id/players), isi link barunya. Data dan halaman situs akan dibaca ulang.
                        </p>
                        <div class="mt-5">
                            <AppInput
                                v-model="url"
                                field-id="url"
                                label="Alamat situs"
                                type="text"
                                autocomplete="url"
                                placeholder="psms.com"
                                :error="errors.url"
                            >
                                <template #append>
                                    <AppButton type="submit" :is-loading="isSubmitting" :is-disabled="!meta.dirty">
                                        {{ isSubmitting ? 'Membaca…' : 'Ganti link' }}
                                    </AppButton>
                                </template>
                            </AppInput>
                        </div>
                    </form>
                </div>

                <aside class="flex flex-col gap-6 lg:col-span-1">
                    <PromotionToggle :domain="domain" @updated="applyStatusUpdate" />
                    <DomainStatusPanel :domain="domain" @updated="applyStatusUpdate" />
                </aside>
            </div>
        </template>
    </div>
</template>
