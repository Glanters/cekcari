<script setup>
defineProps({
    label: { type: String, required: true },
    fieldId: { type: String, required: true },
    error: { type: String, default: '' },
    hint: { type: String, default: '' },
    isOptional: { type: Boolean, default: false },
});
</script>

<template>
    <div class="flex flex-col gap-1.5">
        <label :for="fieldId" class="flex items-baseline gap-2 text-sm font-medium text-ink-800">
            {{ label }}
            <span v-if="isOptional" class="text-xs font-normal text-ink-400">opsional</span>
        </label>
        <slot />
        <p v-if="error" :id="`${fieldId}-error`" class="text-sm text-danger-600" role="alert">{{ error }}</p>
        <p v-else-if="hint" :id="`${fieldId}-hint`" class="text-sm text-ink-500">{{ hint }}</p>
    </div>
</template>
