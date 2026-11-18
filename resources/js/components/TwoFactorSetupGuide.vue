<script setup>
import { computed, ref } from 'vue';
import { Check, Copy } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';

const props = defineProps({
    qrCode: { type: String, required: true },
    secret: { type: String, required: true },
});

const toast = useToast();
const hasCopied = ref(false);

// Dikelompokkan per 4 karakter agar mudah diketik manual di aplikasi authenticator.
const groupedSecret = computed(() => props.secret.match(/.{1,4}/g)?.join(' ') ?? props.secret);

async function copySecret() {
    try {
        await navigator.clipboard.writeText(props.secret);
        hasCopied.value = true;
    } catch {
        toast.error('Kunci gagal disalin', 'Salin kuncinya secara manual.');
    }
}
</script>

<template>
    <ol class="flex flex-col gap-5 text-sm text-ink-700">
        <li class="flex gap-3">
            <span class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 font-mono text-xs text-brand-800">1</span>
            <p>Pasang <span class="font-medium text-ink-900">Google Authenticator</span> atau <span class="font-medium text-ink-900">Authy</span> di ponsel Anda.</p>
        </li>
        <li class="flex gap-3">
            <span class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 font-mono text-xs text-brand-800">2</span>
            <div class="min-w-0 flex-1">
                <p>Pindai kode QR ini dari aplikasi tersebut.</p>
                <div class="mt-3 w-fit rounded-2xl border border-ink-200 bg-white p-3 shadow-card">
                    <img :src="qrCode" alt="Kode QR untuk aplikasi authenticator" width="180" height="180" class="size-44" />
                </div>
                <p class="mt-3 text-ink-500">Tidak bisa memindai? Masukkan kunci ini secara manual:</p>
                <div class="mt-1.5 flex items-center gap-2">
                    <code class="min-w-0 flex-1 rounded-lg bg-ink-100 px-3 py-2 font-mono text-xs break-all text-ink-900">
                        {{ groupedSecret }}
                    </code>
                    <button
                        type="button"
                        class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50"
                        :aria-label="hasCopied ? 'Kunci sudah disalin' : 'Salin kunci'"
                        @click="copySecret"
                    >
                        <Check v-if="hasCopied" class="size-4 text-success-600" aria-hidden="true" />
                        <Copy v-else class="size-4" aria-hidden="true" />
                    </button>
                </div>
            </div>
        </li>
        <li class="flex gap-3">
            <span class="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 font-mono text-xs text-brand-800">3</span>
            <p>Ketik kode 6 angka yang muncul di aplikasi.</p>
        </li>
    </ol>
</template>
