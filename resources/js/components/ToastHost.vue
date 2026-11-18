<script setup>
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';

const { toasts, duration, remove } = useToast();

const VARIANT_STYLES = {
    success: { icon: CircleCheck, iconClass: 'text-success-600' },
    error: { icon: CircleAlert, iconClass: 'text-danger-600' },
    info: { icon: Info, iconClass: 'text-brand-600' },
};

function handleOpenChange(toastId, isOpen) {
    if (!isOpen) {
        remove(toastId);
    }
}
</script>

<template>
    <ToastProvider :duration="duration" swipe-direction="right" label="Notifikasi">
        <ToastRoot
            v-for="toast in toasts"
            :key="toast.id"
            :open="toast.isOpen"
            :type="toast.variant === 'error' ? 'foreground' : 'background'"
            class="flex w-full items-start gap-3 rounded-xl border border-ink-100 bg-surface p-4 shadow-popover data-[state=open]:animate-slide-up"
            @update:open="handleOpenChange(toast.id, $event)"
        >
            <component
                :is="VARIANT_STYLES[toast.variant].icon"
                class="mt-0.5 size-5 shrink-0"
                :class="VARIANT_STYLES[toast.variant].iconClass"
                aria-hidden="true"
            />
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                <ToastTitle class="text-sm font-semibold text-ink-900">{{ toast.title }}</ToastTitle>
                <ToastDescription v-if="toast.description" class="text-sm text-ink-600">
                    {{ toast.description }}
                </ToastDescription>
            </div>
            <ToastClose class="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Tutup">
                <X class="size-4" />
            </ToastClose>
        </ToastRoot>

        <ToastViewport
            class="fixed right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-2 p-4 outline-none"
        />
    </ToastProvider>
</template>
