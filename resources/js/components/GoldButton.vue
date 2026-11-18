<script setup>
import { LoaderCircle } from 'lucide-vue-next';

defineProps({
    size: { type: String, default: 'md', validator: (value) => ['sm', 'md', 'lg'].includes(value) },
    type: { type: String, default: 'submit' },
    isLoading: { type: Boolean, default: false },
});

const SIZE_CLASSES = {
    sm: 'h-9 px-4 text-sm',
    md: 'h-11 px-5 text-sm sm:text-base',
    lg: 'h-12 px-5 text-base sm:h-14 sm:px-7',
};
</script>

<template>
    <button
        :type="type"
        :disabled="isLoading"
        :aria-busy="isLoading"
        class="group/gold inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-linear-to-br from-brand-300 to-brand-500 font-display font-semibold text-ink-950 transition duration-200 hover:brightness-110 disabled:cursor-wait disabled:opacity-80 motion-safe:active:scale-95"
        :class="SIZE_CLASSES[size]"
    >
        <LoaderCircle v-if="isLoading" class="size-4 animate-spin" aria-hidden="true" />
        <slot />
    </button>
</template>
