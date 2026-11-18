<script setup>
defineProps({
    icon: { type: [Object, Function], required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
});
</script>

<template>
    <div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span class="grid size-12 place-items-center rounded-full bg-ink-100 text-ink-500">
            <component :is="icon" class="size-6" aria-hidden="true" />
        </span>
        <h2 class="text-base font-semibold text-ink-900">{{ title }}</h2>
        <p v-if="description" class="max-w-md text-sm text-ink-600">{{ description }}</p>
        <div v-if="$slots.default" class="mt-2">
            <slot />
        </div>
    </div>
</template>
