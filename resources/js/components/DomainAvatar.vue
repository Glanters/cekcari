<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
    logoUrl: { type: String, default: null },
    name: { type: String, required: true },
    size: { type: String, default: 'md', validator: (value) => ['sm', 'md', 'lg'].includes(value) },
});

const hasLogoFailed = ref(false);

const initial = computed(() => props.name.trim().charAt(0).toUpperCase() || '?');

const SIZE_CLASSES = {
    sm: 'size-7 text-xs rounded-md',
    md: 'size-9 text-sm rounded-lg',
    lg: 'size-16 text-xl rounded-xl',
};
</script>

<template>
    <img
        v-if="logoUrl && !hasLogoFailed"
        :src="logoUrl"
        :alt="`Logo ${name}`"
        class="shrink-0 border border-ink-100 bg-surface object-contain"
        :class="SIZE_CLASSES[size]"
        loading="lazy"
        @error="hasLogoFailed = true"
    />
    <span
        v-else
        class="grid shrink-0 place-items-center bg-brand-50 font-semibold text-brand-700"
        :class="SIZE_CLASSES[size]"
        aria-hidden="true"
    >
        {{ initial }}
    </span>
</template>
