<script setup>
import { computed, ref } from 'vue';
import { Download, Share, X } from 'lucide-vue-next';
import GoldButton from '@/components/GoldButton.vue';
import {
    deferredInstallPrompt,
    getLocalStorage,
    installHintKind,
    isIosSafari,
    isRunningStandalone,
    rememberDismissal,
    wasDismissedRecently,
} from '@/lib/pwa';

const storage = getLocalStorage();
const isDismissed = ref(wasDismissedRecently(storage));
const isInstalling = ref(false);

const hintKind = computed(() =>
    installHintKind({
        isStandalone: isRunningStandalone(),
        hasDeferredPrompt: deferredInstallPrompt.value !== null,
        isIos: isIosSafari(window.navigator.userAgent),
        isDismissed: isDismissed.value,
    }),
);

function dismiss() {
    isDismissed.value = true;
    rememberDismissal(storage);
}

async function install() {
    const promptEvent = deferredInstallPrompt.value;

    if (!promptEvent) {
        return;
    }

    isInstalling.value = true;

    try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;

        if (choice.outcome === 'dismissed') {
            dismiss();
        }
    } finally {
        // Prompt asli hanya bisa dipakai sekali; browser akan mengirim yang baru bila masih bisa dipasang.
        deferredInstallPrompt.value = null;
        isInstalling.value = false;
    }
}
</script>

<template>
    <Transition
        enter-active-class="transition duration-300 motion-reduce:transition-none"
        enter-from-class="translate-y-4 opacity-0"
        leave-active-class="transition duration-200 motion-reduce:transition-none"
        leave-to-class="translate-y-4 opacity-0"
    >
        <aside
            v-if="hintKind"
            class="bottom-safe fixed inset-x-4 z-30 mx-auto flex max-w-md items-center gap-3 rounded-3xl border border-white/10 bg-ink-900/95 p-3 text-sm text-ink-200 shadow-glass backdrop-blur-xl"
            aria-label="Pasang aplikasi CekCari"
        >
            <img src="/images/brand/cekcari-logo-128.png" alt="" width="128" height="128" class="size-9 shrink-0" />

            <p v-if="hintKind === 'prompt'" class="min-w-0 flex-1 leading-snug">
                <span class="block font-semibold text-ink-50">Pasang CekCari</span>
                <span class="hidden sm:inline">Buka langsung dari layar utama.</span>
            </p>
            <p v-else class="min-w-0 flex-1 leading-snug">
                <span class="block font-semibold text-ink-50">Pasang CekCari di iPhone</span>
                Ketuk
                <Share class="inline size-4 -translate-y-0.5 text-brand-300" aria-label="Bagikan" />
                lalu pilih <span class="font-medium text-ink-50">“Tambah ke Layar Utama”</span>.
            </p>

            <GoldButton v-if="hintKind === 'prompt'" type="button" size="sm" :is-loading="isInstalling" @click="install">
                <Download v-if="!isInstalling" class="size-4" aria-hidden="true" />
                Pasang
            </GoldButton>
            <button
                type="button"
                class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-400 transition-colors hover:bg-white/10 hover:text-ink-100"
                aria-label="Tutup ajakan pasang aplikasi"
                @click="dismiss"
            >
                <X class="size-4" />
            </button>
        </aside>
    </Transition>
</template>
