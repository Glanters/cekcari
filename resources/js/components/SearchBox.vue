<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { AutocompleteInput, AutocompleteRoot, ComboboxContent, ComboboxItem, ComboboxViewport } from 'reka-ui';
import { ArrowRight, ArrowUpLeft, Search, X } from 'lucide-vue-next';
import GlassField from '@/components/GlassField.vue';
import GoldButton from '@/components/GoldButton.vue';
import http from '@/lib/http';
import { debounce } from '@/lib/debounce';

const props = defineProps({
    size: { type: String, default: 'md', validator: (value) => ['md', 'lg'].includes(value) },
    isAutofocus: { type: Boolean, default: false },
});

const emit = defineEmits(['submit']);
const query = defineModel('query', { type: String, default: '' });

const MIN_SUGGESTION_LENGTH = 2;
const SUGGESTION_DELAY_MS = 200;

const suggestions = ref([]);
const isOpenRequested = ref(false);
let latestRequestId = 0;

const isOpen = computed({
    get: () => isOpenRequested.value && suggestions.value.length > 0,
    set: (value) => {
        isOpenRequested.value = value;
    },
});

const fetchSuggestions = debounce(async (keyword) => {
    const requestId = ++latestRequestId;

    try {
        const response = await http.get('/search-suggestions', { params: { q: keyword } });

        // Jawaban yang datang terlambat dari ketikan sebelumnya diabaikan.
        if (requestId === latestRequestId) {
            suggestions.value = response.data.data.items;
        }
    } catch {
        // Saran hanya pelengkap; bila gagal, kolom pencarian tetap bisa dipakai tanpa saran.
        suggestions.value = [];
    }
}, SUGGESTION_DELAY_MS);

watch(query, (keyword) => {
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword.length < MIN_SUGGESTION_LENGTH) {
        fetchSuggestions.cancel();
        latestRequestId++;
        suggestions.value = [];

        return;
    }

    fetchSuggestions(trimmedKeyword);
});

onBeforeUnmount(() => fetchSuggestions.cancel());

function submit(keyword) {
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword === '') {
        return;
    }

    isOpenRequested.value = false;
    emit('submit', trimmedKeyword);
}

function selectSuggestion(suggestion) {
    query.value = suggestion;
    submit(suggestion);
}

function clearQuery() {
    query.value = '';
    suggestions.value = [];
}

const isLarge = computed(() => props.size === 'lg');
</script>

<template>
    <form role="search" class="relative w-full" @submit.prevent="submit(query)">
        <AutocompleteRoot v-model="query" v-model:open="isOpen" ignore-filter>
            <GlassField :size="isLarge ? 'lg' : 'sm'">
                <Search class="shrink-0 text-brand-300" :class="isLarge ? 'size-5 sm:size-6' : 'size-4'" aria-hidden="true" />
                <AutocompleteInput
                    :auto-focus="isAutofocus"
                    placeholder="Cari situs atau topik…"
                    aria-label="Kata kunci pencarian"
                    enterkeyhint="search"
                    class="h-full min-w-0 flex-1 bg-transparent text-ink-50 caret-brand-300 outline-none placeholder:text-ink-400"
                    :class="isLarge ? 'text-base sm:text-xl' : 'text-base sm:text-sm'"
                    @focus="isOpenRequested = true"
                />
                <button
                    v-if="query"
                    type="button"
                    class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/10 hover:text-ink-100"
                    aria-label="Hapus kata kunci"
                    @click="clearQuery"
                >
                    <X class="size-4" />
                </button>
                <GoldButton :size="isLarge ? 'lg' : 'sm'">
                    <span :class="isLarge ? '' : 'sr-only sm:not-sr-only'">Cari</span>
                    <ArrowRight
                        class="size-4 transition-transform duration-200 motion-safe:group-hover/gold:translate-x-0.5"
                        :class="isLarge ? 'hidden sm:block' : 'sm:hidden'"
                        aria-hidden="true"
                    />
                </GoldButton>
            </GlassField>

            <ComboboxContent
                position="inline"
                class="absolute inset-x-0 top-full z-30 mt-3 overflow-hidden rounded-3xl border border-white/10 bg-ink-900/95 p-2 shadow-glass backdrop-blur-xl data-[state=open]:animate-slide-up"
            >
                <p class="px-3 pt-1.5 pb-2 text-xs font-medium tracking-widest text-ink-500 uppercase">Saran</p>
                <ComboboxViewport>
                    <ComboboxItem
                        v-for="suggestion in suggestions"
                        :key="suggestion"
                        :value="suggestion"
                        class="group/item flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-base text-ink-200 outline-none transition-colors data-[highlighted]:bg-white/8 data-[highlighted]:text-ink-50"
                        @select.prevent="selectSuggestion(suggestion)"
                    >
                        <Search class="size-4 shrink-0 text-ink-500 group-data-[highlighted]/item:text-brand-300" aria-hidden="true" />
                        <span class="line-clamp-2 flex-1">{{ suggestion }}</span>
                        <ArrowUpLeft class="size-4 shrink-0 text-ink-600 group-data-[highlighted]/item:text-ink-300" aria-hidden="true" />
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxContent>
        </AutocompleteRoot>
    </form>
</template>
