<script setup>
import { computed, ref } from 'vue';
import { CircleCheck, CircleX, Clock, Link2, LoaderCircle } from 'lucide-vue-next';
import GlassField from '@/components/GlassField.vue';
import GoldButton from '@/components/GoldButton.vue';
import http from '@/lib/http';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { MAX_SITES_PER_BATCH, parseSiteAddresses } from '@/lib/siteAddress';

const props = defineProps({
    // Diisi superadmin yang mendaftarkan situs atas nama member; null berarti untuk diri sendiri.
    ownerId: { type: Number, default: null },
});

const emit = defineEmits(['finished']);

const MAX_VISIBLE_ROWS = 6;

const STATUS_ICONS = {
    waiting: { icon: Clock, classes: 'text-ink-500' },
    processing: { icon: LoaderCircle, classes: 'text-brand-300 motion-safe:animate-spin' },
    added: { icon: CircleCheck, classes: 'text-brand-300' },
    failed: { icon: CircleX, classes: 'text-danger-300' },
};

const addressText = ref('');
const queue = ref([]);
const errorMessage = ref('');
const isProcessing = ref(false);

const entries = computed(() => parseSiteAddresses(addressText.value));
const rowCount = computed(() => Math.min(Math.max(addressText.value.split('\n').length, 1), MAX_VISIBLE_ROWS));
const processedCount = computed(() => queue.value.filter((item) => ['added', 'failed'].includes(item.status)).length);

const buttonLabel = computed(() => {
    if (isProcessing.value) {
        return `Memproses ${processedCount.value}/${queue.value.length}…`;
    }

    return entries.value.length > 1 ? `Tambahkan ${entries.value.length} situs` : 'Tambahkan';
});

async function addSite(item) {
    item.status = 'processing';
    item.message = 'Membaca situs…';

    try {
        const response = await http.post('/domains', { url: item.address, user_id: props.ownerId ?? undefined });
        item.status = 'added';
        item.message = response.data.data.title;
        item.domainId = response.data.data.id;
    } catch (error) {
        item.status = 'failed';
        item.message = getFieldErrors(error).url ?? getFieldErrors(error).user_id ?? getErrorMessage(error);
    }
}

// Situs diproses satu per satu supaya setiap baris punya hasil sendiri dan server situs tidak dibanjiri.
async function submit() {
    if (isProcessing.value) {
        return;
    }

    if (entries.value.length === 0) {
        errorMessage.value = 'Isi alamat situs, misalnya psms.com.';

        return;
    }

    if (entries.value.length > MAX_SITES_PER_BATCH) {
        errorMessage.value = `Maksimal ${MAX_SITES_PER_BATCH} situs sekali tambah. Saat ini ada ${entries.value.length}.`;

        return;
    }

    errorMessage.value = '';
    queue.value = entries.value.map((entry) => ({
        ...entry,
        status: entry.isValid ? 'waiting' : 'failed',
        message: entry.isValid ? 'Menunggu giliran' : 'Bukan alamat situs yang valid.',
        domainId: null,
    }));
    addressText.value = '';
    isProcessing.value = true;

    for (const item of queue.value) {
        if (item.status === 'waiting') {
            await addSite(item);
        }
    }

    isProcessing.value = false;
    emit('finished', {
        addedCount: queue.value.filter((item) => item.status === 'added').length,
        totalCount: queue.value.length,
    });
}

function clearQueue() {
    queue.value = [];
}
</script>

<template>
    <div>
        <form novalidate @submit.prevent="submit">
            <label for="new-domain-addresses" class="sr-only">Alamat situs yang ingin didaftarkan</label>
            <GlassField is-multiline :has-error="errorMessage !== ''">
                <Link2 class="mb-3.5 size-5 shrink-0 text-brand-300" aria-hidden="true" />
                <textarea
                    id="new-domain-addresses"
                    v-model="addressText"
                    :rows="rowCount"
                    inputmode="url"
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck="false"
                    placeholder="psms.com"
                    class="min-w-0 flex-1 resize-none self-center bg-transparent py-2.5 text-base leading-6 text-ink-50 caret-brand-300 outline-none placeholder:text-ink-500"
                    :aria-invalid="errorMessage ? 'true' : 'false'"
                    aria-describedby="new-domain-addresses-help"
                    :disabled="isProcessing"
                    @keydown.enter.exact.prevent="submit"
                />
                <GoldButton :is-loading="isProcessing">{{ buttonLabel }}</GoldButton>
            </GlassField>
            <p
                id="new-domain-addresses-help"
                class="mt-3 pl-5 text-sm"
                :class="errorMessage ? 'text-danger-300' : 'text-ink-400'"
                :role="errorMessage ? 'alert' : undefined"
            >
                <template v-if="errorMessage">{{ errorMessage }}</template>
                <template v-else>
                    Cukup tulis alamatnya, misalnya <span class="font-mono text-ink-300">psms.com</span>. Untuk
                    beberapa situs sekaligus, tempel satu per baris (Shift+Enter untuk baris baru).
                </template>
            </p>
        </form>

        <section
            v-if="queue.length"
            class="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl"
            aria-labelledby="queue-heading"
        >
            <div class="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
                <h2 id="queue-heading" class="text-xs font-medium tracking-wider text-ink-400 uppercase">
                    {{ isProcessing ? 'Sedang menambahkan' : 'Hasil penambahan' }}
                </h2>
                <button
                    v-if="!isProcessing"
                    type="button"
                    class="cursor-pointer rounded-full px-2 py-1 text-xs font-medium text-ink-400 transition-colors hover:bg-white/10 hover:text-ink-100"
                    @click="clearQueue"
                >
                    Tutup
                </button>
            </div>
            <ul class="divide-y divide-white/5" aria-live="polite">
                <li v-for="item in queue" :key="item.address" class="flex items-start gap-3 px-5 py-3">
                    <component
                        :is="STATUS_ICONS[item.status].icon"
                        class="mt-0.5 size-4 shrink-0"
                        :class="STATUS_ICONS[item.status].classes"
                        aria-hidden="true"
                    />
                    <div class="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-4">
                        <p class="truncate font-mono text-sm text-ink-100 sm:w-48 sm:shrink-0">{{ item.address }}</p>
                        <p class="text-sm" :class="item.status === 'failed' ? 'text-danger-300' : 'text-ink-400'">
                            {{ item.message }}
                        </p>
                    </div>
                    <RouterLink
                        v-if="item.domainId"
                        :to="{ name: 'domains.show', params: { id: item.domainId } }"
                        class="shrink-0 text-sm font-medium text-brand-300 hover:text-brand-200 hover:underline"
                    >
                        Kelola
                    </RouterLink>
                </li>
            </ul>
        </section>
    </div>
</template>
