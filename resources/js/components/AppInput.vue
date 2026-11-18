<script setup>
import { computed } from 'vue';
import FormField from '@/components/FormField.vue';

const props = defineProps({
    label: { type: String, required: true },
    fieldId: { type: String, required: true },
    type: { type: String, default: 'text' },
    error: { type: String, default: '' },
    hint: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    autocomplete: { type: String, default: 'off' },
    isMultiline: { type: Boolean, default: false },
    isOptional: { type: Boolean, default: false },
    maxLength: { type: Number, default: null },
    // Mis. "numeric" untuk kode 2FA agar ponsel langsung membuka papan angka.
    inputMode: { type: String, default: null },
});

const model = defineModel({ type: String, default: '' });

// Atribut bersama input & textarea; v-model ditulis langsung di tiap elemen karena
// v-model pada <component :is> tidak terikat sebagai input native.
const sharedAttributes = computed(() => ({
    id: props.fieldId,
    placeholder: props.placeholder,
    autocomplete: props.autocomplete,
    maxlength: props.maxLength ?? undefined,
    inputmode: props.inputMode ?? undefined,
    'aria-invalid': props.error ? 'true' : 'false',
    'aria-describedby': props.error ? `${props.fieldId}-error` : props.hint ? `${props.fieldId}-hint` : undefined,
    class: [
        'w-full min-w-0 rounded-lg border bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none',
        props.error ? 'border-danger-600' : 'border-ink-200',
    ],
}));
</script>

<template>
    <FormField :label="label" :field-id="fieldId" :error="error" :hint="hint" :is-optional="isOptional">
        <div class="flex items-stretch gap-2">
            <textarea v-if="isMultiline" v-model="model" v-bind="sharedAttributes" rows="4" class="resize-y" />
            <input v-else v-model="model" v-bind="sharedAttributes" :type="type" class="h-11" />
            <slot name="append" />
        </div>
        <p v-if="maxLength" class="-mt-1 self-end text-xs text-ink-400" aria-hidden="true">
            {{ model.length }}/{{ maxLength }}
        </p>
    </FormField>
</template>
