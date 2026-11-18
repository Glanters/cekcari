import { ref } from 'vue';

const TOAST_DURATION_MS = 4500;

// State modul (bukan per komponen) supaya toast dari halaman mana pun tampil di satu ToastHost.
const toasts = ref([]);
let nextToastId = 1;

function push(variant, title, description = '') {
    toasts.value.push({ id: nextToastId++, variant, title, description, isOpen: true });
}

export function useToast() {
    return {
        toasts,
        duration: TOAST_DURATION_MS,
        success: (title, description) => push('success', title, description),
        error: (title, description) => push('error', title, description),
        info: (title, description) => push('info', title, description),
        remove: (toastId) => {
            toasts.value = toasts.value.filter((toast) => toast.id !== toastId);
        },
    };
}
