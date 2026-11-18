<script setup>
import { computed, ref } from 'vue';
import { AutocompleteInput, AutocompleteRoot, ComboboxContent, ComboboxItem, ComboboxViewport } from 'reka-ui';
import { ArrowRight, History, Search, X } from 'lucide-vue-next';
import GlassField from '@/components/GlassField.vue';
import GoldButton from '@/components/GoldButton.vue';
import { getLocalStorage } from '@/lib/pwa';
import { addToHistory, matchHistory, readHistory, removeFromHistory } from '@/lib/searchHistory';

const props = defineProps({
    size: { type: String, default: 'md', validator: (value) => ['md', 'lg'].includes(value) },
    isAutofocus: { type: Boolean, default: false },
});

const emit = defineEmits(['submit']);
const query = defineModel('query', { type: String, default: '' });

// Saran hanya dari riwayat pencarian pengunjung ini sendiri (disimpan di browsernya).
const storage = getLocalStorage();
const history = ref(readHistory(storage));
const isOpenRequested = ref(false);

const suggestions = computed(() => matchHistory(history.value, query.value));

const isOpen = computed({
    get: () => isOpenRequested.value && suggestions.value.length > 0,
    set: (value) => {
        isOpenRequested.value = value;
    },
});

function submit(keyword) {
    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword === '') {
        return;
    }

    history.value = addToHistory(storage, trimmedKeyword);
    isOpenRequested.value = false;
    emit('submit', trimmedKeyword);
}

function selectSuggestion(suggestion) {
    query.value = suggestion;
    submit(suggestion);
}

function forget(entry) {
    history.value = removeFromHistory(storage, entry);
}

function clearQuery() {
    query.value = '';
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
                <p class="px-3 pt-1.5 pb-2 text-xs font-medium tracking-widest text-ink-500 uppercase">Pencarian terakhir</p>
                <ComboboxViewport>
                    <ComboboxItem
                        v-for="suggestion in suggestions"
                        :key="suggestion"
                        :value="suggestion"
                        class="group/item flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-base text-ink-200 outline-none transition-colors data-[highlighted]:bg-white/8 data-[highlighted]:text-ink-50"
                        @select.prevent="selectSuggestion(suggestion)"
                    >
                        <History class="size-4 shrink-0 text-ink-500 group-data-[highlighted]/item:text-brand-300" aria-hidden="true" />
                        <span class="line-clamp-2 flex-1">{{ suggestion }}</span>
                        <button
                            type="button"
                            class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-500 transition-colors hover:bg-white/10 hover:text-ink-100"
                            :aria-label="`Hapus ${suggestion} dari riwayat`"
                            @pointerdown.stop
                            @pointerup.stop
                            @click.stop.prevent="forget(suggestion)"
                        >
                            <X class="size-4" aria-hidden="true" />
                        </button>
                    </ComboboxItem>
                </ComboboxViewport>
            </ComboboxContent>
        </AutocompleteRoot>
    </form>
</template>
