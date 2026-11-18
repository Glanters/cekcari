<script setup>
import {
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogOverlay,
    AlertDialogPortal,
    AlertDialogRoot,
    AlertDialogTitle,
} from 'reka-ui';
import AppButton from '@/components/AppButton.vue';

defineProps({
    title: { type: String, required: true },
    description: { type: String, required: true },
    confirmLabel: { type: String, default: 'Ya, hapus' },
    isProcessing: { type: Boolean, default: false },
});

const emit = defineEmits(['confirm']);
const isOpen = defineModel('open', { type: Boolean, default: false });
</script>

<template>
    <AlertDialogRoot v-model:open="isOpen">
        <AlertDialogPortal>
            <AlertDialogOverlay class="fixed inset-0 z-40 bg-ink-900/40 data-[state=open]:animate-fade-in" />
            <AlertDialogContent
                class="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-popover data-[state=open]:animate-fade-in"
            >
                <AlertDialogTitle class="text-lg font-semibold text-ink-900">{{ title }}</AlertDialogTitle>
                <AlertDialogDescription class="mt-2 text-sm text-ink-600">{{ description }}</AlertDialogDescription>
                <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <AlertDialogCancel as-child>
                        <AppButton variant="secondary" :is-disabled="isProcessing">Batal</AppButton>
                    </AlertDialogCancel>
                    <AlertDialogAction as-child @click.prevent="emit('confirm')">
                        <AppButton variant="danger" :is-loading="isProcessing">{{ confirmLabel }}</AppButton>
                    </AlertDialogAction>
                </div>
            </AlertDialogContent>
        </AlertDialogPortal>
    </AlertDialogRoot>
</template>
