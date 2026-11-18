<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { LoaderCircle } from 'lucide-vue-next';

const props = defineProps({
    variant: {
        type: String,
        default: 'primary',
        validator: (value) => ['primary', 'secondary', 'ghost', 'danger'].includes(value),
    },
    size: { type: String, default: 'md', validator: (value) => ['sm', 'md'].includes(value) },
    type: { type: String, default: 'button' },
    to: { type: [String, Object], default: null },
    isLoading: { type: Boolean, default: false },
    isDisabled: { type: Boolean, default: false },
});

const VARIANT_CLASSES = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'border border-ink-200 bg-surface text-ink-800 hover:bg-ink-50',
    ghost: 'text-ink-700 hover:bg-ink-100',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 shadow-sm',
};

const SIZE_CLASSES = {
    sm: 'h-8 gap-1.5 px-3 text-sm',
    md: 'h-11 gap-2 px-5 text-sm',
};

const classes = computed(() => [
    'inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANT_CLASSES[props.variant],
    SIZE_CLASSES[props.size],
]);
</script>

<template>
    <RouterLink v-if="to" :to="to" :class="classes">
        <slot />
    </RouterLink>
    <button v-else :type="type" :class="classes" :disabled="isDisabled || isLoading" :aria-busy="isLoading">
        <LoaderCircle v-if="isLoading" class="size-4 animate-spin" aria-hidden="true" />
        <slot />
    </button>
</template>
