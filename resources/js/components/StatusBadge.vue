<script setup>
import { computed } from 'vue';

const props = defineProps({
    status: {
        type: String,
        required: true,
        validator: (value) => ['pending', 'crawling', 'done', 'failed', 'redirected'].includes(value),
    },
});

const STATUS_DISPLAY = {
    pending: { label: 'Antre diproses', classes: 'bg-ink-100 text-ink-700' },
    crawling: { label: 'Sedang membaca situs', classes: 'bg-brand-50 text-brand-700' },
    done: { label: 'Selesai', classes: 'bg-success-50 text-success-700' },
    failed: { label: 'Gagal dibaca', classes: 'bg-danger-50 text-danger-700' },
    redirected: { label: 'Dialihkan', classes: 'bg-warning-50 text-warning-700' },
};

const display = computed(() => STATUS_DISPLAY[props.status]);
</script>

<template>
    <span
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
        :class="display.classes"
    >
        <span class="size-1.5 rounded-full bg-current" aria-hidden="true" />
        {{ display.label }}
    </span>
</template>
