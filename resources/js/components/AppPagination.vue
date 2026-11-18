<script setup>
import {
    PaginationEllipsis,
    PaginationList,
    PaginationListItem,
    PaginationNext,
    PaginationPrev,
    PaginationRoot,
} from 'reka-ui';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';

defineProps({
    total: { type: Number, required: true },
    perPage: { type: Number, required: true },
});

const page = defineModel('page', { type: Number, required: true });

const ITEM_CLASS =
    'grid size-9 place-items-center rounded-lg text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100 disabled:opacity-40 disabled:hover:bg-transparent';
</script>

<template>
    <PaginationRoot
        v-if="total > perPage"
        v-model:page="page"
        :total="total"
        :items-per-page="perPage"
        :sibling-count="1"
        show-edges
    >
        <PaginationList v-slot="{ items }" class="flex flex-wrap items-center justify-center gap-1">
            <PaginationPrev :class="ITEM_CLASS" aria-label="Halaman sebelumnya">
                <ChevronLeft class="size-4" />
            </PaginationPrev>
            <template v-for="(pageItem, index) in items" :key="index">
                <PaginationListItem
                    v-if="pageItem.type === 'page'"
                    :value="pageItem.value"
                    :class="ITEM_CLASS"
                    class="data-[selected]:bg-brand-600 data-[selected]:text-white"
                >
                    {{ pageItem.value }}
                </PaginationListItem>
                <PaginationEllipsis v-else :index="index" class="grid size-9 place-items-center text-ink-400">
                    …
                </PaginationEllipsis>
            </template>
            <PaginationNext :class="ITEM_CLASS" aria-label="Halaman berikutnya">
                <ChevronRight class="size-4" />
            </PaginationNext>
        </PaginationList>
    </PaginationRoot>
</template>
