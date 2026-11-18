<script setup>
import { ref } from 'vue';
import { Check, Copy, KeyRound } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import { useToast } from '@/composables/useToast';

const props = defineProps({
    codes: { type: Array, required: true },
});

const emit = defineEmits(['continue']);

const toast = useToast();
const hasCopied = ref(false);

async function copyCodes() {
    try {
        await navigator.clipboard.writeText(props.codes.join('\n'));
        hasCopied.value = true;
        toast.success('Recovery code disalin');
    } catch {
        toast.error('Gagal menyalin', 'Catat kodenya secara manual.');
    }
}
</script>

<template>
    <div class="flex flex-col gap-5">
        <div class="flex gap-3 rounded-2xl border border-warning-600/20 bg-warning-50 p-4 text-sm text-ink-700">
            <KeyRound class="mt-0.5 size-5 shrink-0 text-warning-700" aria-hidden="true" />
            <p>
                Simpan kode di bawah ini di tempat aman. Bila ponsel hilang, satu kode bisa dipakai untuk masuk menggantikan kode
                authenticator. <span class="font-medium text-ink-900">Kode ini tidak akan ditampilkan lagi.</span>
            </p>
        </div>

        <ul class="grid grid-cols-2 gap-2" aria-label="Recovery code">
            <li v-for="code in codes" :key="code" class="rounded-lg bg-ink-100 px-3 py-2 text-center font-mono text-sm text-ink-900">
                {{ code }}
            </li>
        </ul>

        <div class="flex flex-col gap-2 sm:flex-row">
            <AppButton variant="secondary" class="sm:flex-1" @click="copyCodes">
                <Check v-if="hasCopied" class="size-4 text-success-600" aria-hidden="true" />
                <Copy v-else class="size-4" aria-hidden="true" />
                {{ hasCopied ? 'Sudah disalin' : 'Salin semua' }}
            </AppButton>
            <AppButton class="sm:flex-1" @click="emit('continue')">Sudah saya simpan, lanjut</AppButton>
        </div>
    </div>
</template>
