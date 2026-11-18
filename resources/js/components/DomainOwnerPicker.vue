<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxRoot, ComboboxViewport } from 'reka-ui';
import { ChevronDown, UserRound, X } from 'lucide-vue-next';
import http from '@/lib/http';
import { getErrorMessage } from '@/lib/apiErrors';
import { debounce } from '@/lib/debounce';
import { useToast } from '@/composables/useToast';

const SEARCH_DELAY_MS = 250;

// null berarti situs didaftarkan untuk superadmin sendiri.
const owner = defineModel({ type: Object, default: null });

const toast = useToast();
const searchTerm = ref('');
const owners = ref([]);
const isOpen = ref(false);
let latestRequestId = 0;

async function loadOwners(keyword) {
    const requestId = ++latestRequestId;

    try {
        const response = await http.get('/domain-owners', { params: { q: keyword || undefined } });

        // Jawaban dari ketikan sebelumnya yang datang terlambat diabaikan.
        if (requestId === latestRequestId) {
            owners.value = response.data.data.items;
        }
    } catch (error) {
        toast.error('Daftar member gagal dimuat', getErrorMessage(error));
    }
}

const searchOwners = debounce((keyword) => loadOwners(keyword), SEARCH_DELAY_MS);

watch(searchTerm, (keyword) => searchOwners(keyword.trim()));
watch(isOpen, (isOpening) => {
    if (isOpening && owners.value.length === 0) {
        loadOwners('');
    }
});
onBeforeUnmount(() => searchOwners.cancel());

function resetToSelf() {
    owner.value = null;
    searchTerm.value = '';
}
</script>

<template>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span id="domain-owner-label" class="text-ink-400">Tambahkan untuk</span>
        <ComboboxRoot v-model="owner" v-model:open="isOpen" by="id" ignore-filter class="relative min-w-0 flex-1 sm:max-w-sm">
            <ComboboxAnchor
                class="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 pr-1.5 pl-3.5 text-ink-50 transition-colors focus-within:border-brand-300/60"
            >
                <UserRound class="size-4 shrink-0 text-brand-300" aria-hidden="true" />
                <ComboboxInput
                    v-model="searchTerm"
                    :display-value="(selected) => (selected ? `${selected.name} · ${selected.email}` : '')"
                    placeholder="Saya sendiri"
                    aria-labelledby="domain-owner-label"
                    class="min-w-0 flex-1 truncate bg-transparent outline-none placeholder:text-ink-300"
                    @focus="isOpen = true"
                />
                <button
                    v-if="owner"
                    type="button"
                    class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-ink-400 hover:bg-white/10 hover:text-ink-50"
                    aria-label="Kembali ke saya sendiri"
                    @click="resetToSelf"
                >
                    <X class="size-4" />
                </button>
                <ChevronDown v-else class="size-4 shrink-0 text-ink-400" aria-hidden="true" />
            </ComboboxAnchor>

            <ComboboxContent
                position="popper"
                :side-offset="6"
                class="z-30 w-80 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 p-1.5 shadow-glass backdrop-blur-xl"
            >
                <ComboboxViewport class="max-h-72">
                    <ComboboxEmpty class="px-3 py-2.5 text-ink-400">Tidak ada member aktif yang cocok.</ComboboxEmpty>
                    <ComboboxItem
                        v-for="candidate in owners"
                        :key="candidate.id"
                        :value="candidate"
                        class="flex cursor-pointer flex-col rounded-xl px-3 py-2 outline-none data-[highlighted]:bg-white/10"
                    >
                        <span class="truncate text-ink-50">{{ candidate.name }}</span>
                        <span class="truncate font-mono text-xs text-ink-400">{{ candidate.email }}</span>
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxContent>
        </ComboboxRoot>
    </div>
</template>
