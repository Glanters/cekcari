<script setup>
import { computed, onMounted, ref } from 'vue';
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { CircleAlert, ShieldCheck, ShieldOff } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import EmptyState from '@/components/EmptyState.vue';
import IpWhitelistCard from '@/components/IpWhitelistCard.vue';
import http from '@/lib/http';
import { getErrorMessage } from '@/lib/apiErrors';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const settings = ref(null);
const isLoading = ref(true);
const isSaving = ref(false);
const errorMessage = ref('');
const isConfirmOffOpen = ref(false);

const isTwoFactorRequired = computed(() => settings.value?.is_two_factor_required ?? false);

async function loadSettings() {
    isLoading.value = true;
    errorMessage.value = '';

    try {
        const response = await http.get('/security-settings');
        settings.value = response.data.data;
    } catch (error) {
        errorMessage.value = getErrorMessage(error);
    } finally {
        isLoading.value = false;
    }
}

async function saveTwoFactorRequirement(isRequired) {
    isSaving.value = true;

    try {
        const response = await http.put('/security-settings', { is_two_factor_required: isRequired });
        settings.value = response.data.data;
        toast.success(response.data.message);
        isConfirmOffOpen.value = false;
    } catch (error) {
        toast.error('Pengaturan gagal disimpan', getErrorMessage(error));
    } finally {
        isSaving.value = false;
    }
}

// Mematikan 2FA melemahkan keamanan semua akun, jadi dikonfirmasi dulu; menyalakannya langsung disimpan.
function handleToggle(isRequired) {
    if (isRequired) {
        saveTwoFactorRequirement(true);
    } else {
        isConfirmOffOpen.value = true;
    }
}

onMounted(loadSettings);
</script>

<template>
    <div>
        <section class="relative isolate overflow-hidden bg-hero" aria-labelledby="security-heading">
            <div class="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" aria-hidden="true" />
            <div class="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 sm:pt-14 sm:pb-14">
                <h1 id="security-heading" class="font-display text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">Keamanan</h1>
                <p class="mt-2 max-w-2xl text-ink-400">Atur cara semua pengguna masuk ke panel CekCari.</p>
            </div>
        </section>

        <div class="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
            <div
                v-if="isLoading && settings === null"
                class="h-40 animate-pulse rounded-3xl border border-ink-200/70 bg-surface"
                aria-busy="true"
            />

            <div v-else-if="errorMessage" class="rounded-3xl border border-ink-200/70 bg-surface">
                <EmptyState :icon="CircleAlert" title="Pengaturan gagal dimuat" :description="errorMessage">
                    <AppButton variant="secondary" @click="loadSettings">Muat ulang</AppButton>
                </EmptyState>
            </div>

            <div v-else class="flex flex-col gap-6">
                <section
                    class="rounded-3xl border p-6 transition-colors"
                    :class="isTwoFactorRequired ? 'border-ink-200/70 bg-surface' : 'border-warning-600/30 bg-warning-50'"
                    aria-labelledby="two-factor-heading"
                >
                    <div class="flex items-start justify-between gap-4">
                        <div class="flex items-start gap-3">
                            <span
                                class="grid size-9 shrink-0 place-items-center rounded-xl"
                                :class="isTwoFactorRequired ? 'bg-success-50 text-success-700' : 'bg-warning-600/15 text-warning-700'"
                            >
                                <ShieldCheck v-if="isTwoFactorRequired" class="size-4" aria-hidden="true" />
                                <ShieldOff v-else class="size-4" aria-hidden="true" />
                            </span>
                            <div>
                                <h2 id="two-factor-heading" class="font-display text-lg font-semibold text-ink-900">
                                    Wajibkan verifikasi dua langkah (2FA)
                                </h2>
                                <p class="mt-1 text-sm text-ink-600">
                                    <template v-if="isTwoFactorRequired">
                                        Aktif. Setelah kata sandi Account Center, setiap pengguna memasukkan kode dari Google Authenticator
                                        atau Authy. Pengguna yang belum memasang 2FA diminta memasangnya saat masuk.
                                    </template>
                                    <template v-else>
                                        Mati. Pengguna masuk cukup dengan akun Account Center. Cocok untuk masa uji; nyalakan lagi sebelum
                                        CekCari dipakai umum. Kunci 2FA yang sudah dipasang pengguna tetap tersimpan.
                                    </template>
                                </p>
                            </div>
                        </div>
                        <SwitchRoot
                            :model-value="isTwoFactorRequired"
                            :disabled="isSaving"
                            aria-labelledby="two-factor-heading"
                            class="relative mt-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-ink-300 transition-colors disabled:cursor-wait disabled:opacity-60 data-[state=checked]:bg-success-600"
                            @update:model-value="handleToggle"
                        >
                            <SwitchThumb
                                class="block size-5 translate-x-1 rounded-full bg-surface shadow-card transition-transform data-[state=checked]:translate-x-6"
                            />
                        </SwitchRoot>
                    </div>
                </section>

                <IpWhitelistCard :settings="settings" @settings-updated="settings = $event" />
            </div>
        </div>

        <ConfirmDialog
            v-model:open="isConfirmOffOpen"
            title="Matikan 2FA untuk semua akun?"
            description="Siapa pun yang mengetahui kata sandi Account Center sebuah akun bisa masuk ke panel tanpa kode dari ponsel."
            confirm-label="Ya, matikan 2FA"
            :is-processing="isSaving"
            @confirm="saveTwoFactorRequirement(false)"
        />
    </div>
</template>
