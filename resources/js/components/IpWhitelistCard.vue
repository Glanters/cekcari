<script setup>
import { computed, onMounted, ref } from 'vue';
import { useForm } from 'vee-validate';
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { Network, Plus, Trash2 } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import AppPagination from '@/components/AppPagination.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import http from '@/lib/http';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { isRequired } from '@/lib/validators';
import { useToast } from '@/composables/useToast';

const PER_PAGE = 50;

const props = defineProps({
    settings: { type: Object, required: true },
});

const emit = defineEmits(['settings-updated']);

const toast = useToast();
const entries = ref([]);
const pagination = ref({ page: 1, per_page: PER_PAGE, total: 0, last_page: 1 });
const isLoadingEntries = ref(true);
const isSavingToggle = ref(false);
const isConfirmEnableOpen = ref(false);
const entryPendingDeletion = ref(null);
const isDeleteDialogOpen = ref(false);
const isDeleting = ref(false);

const isEnabled = computed(() => props.settings.is_ip_whitelist_enabled);

const { defineField, errors, handleSubmit, isSubmitting, setErrors, resetForm } = useForm({
    validationSchema: { value: isRequired('Alamat IP') },
    initialValues: { value: '', label: '' },
});

const [entryValue] = defineField('value');
const [entryLabel] = defineField('label');

async function loadEntries(page = pagination.value.page) {
    isLoadingEntries.value = true;

    try {
        const response = await http.get('/ip-whitelist-entries', { params: { page, per_page: PER_PAGE } });
        entries.value = response.data.data.items;
        pagination.value = response.data.data.pagination;
    } catch (error) {
        toast.error('Whitelist IP gagal dimuat', getErrorMessage(error));
    } finally {
        isLoadingEntries.value = false;
    }
}

// Status "IP Anda terdaftar" bergantung pada isi daftar, jadi pengaturan dimuat ulang setelah daftar berubah.
async function refreshSettings() {
    const response = await http.get('/security-settings');
    emit('settings-updated', response.data.data);
}

const addEntry = handleSubmit(async (values) => {
    try {
        const response = await http.post('/ip-whitelist-entries', values);
        toast.success(response.data.message);
        resetForm({ values: { value: '', label: '' } });
        await Promise.all([loadEntries(), refreshSettings()]);
    } catch (error) {
        setErrors(getFieldErrors(error));

        if (error.response?.status !== 422) {
            toast.error('Alamat gagal ditambahkan', getErrorMessage(error));
        }
    }
});

function useCurrentIp() {
    entryValue.value = props.settings.current_ip;
}

async function saveEnabled(isEnabling) {
    isSavingToggle.value = true;

    try {
        const response = await http.put('/security-settings', { is_ip_whitelist_enabled: isEnabling });
        emit('settings-updated', response.data.data);
        toast.success(response.data.message);
        isConfirmEnableOpen.value = false;
    } catch (error) {
        toast.error('Whitelist IP gagal diubah', getErrorMessage(error));
    } finally {
        isSavingToggle.value = false;
    }
}

// Menyalakan whitelist bisa langsung memutus member yang sedang di luar jaringan, jadi dikonfirmasi dulu.
function handleToggle(isEnabling) {
    if (isEnabling) {
        isConfirmEnableOpen.value = true;
    } else {
        saveEnabled(false);
    }
}

function askDelete(entry) {
    entryPendingDeletion.value = entry;
    isDeleteDialogOpen.value = true;
}

async function deleteEntry() {
    isDeleting.value = true;

    try {
        const response = await http.delete(`/ip-whitelist-entries/${entryPendingDeletion.value.id}`);
        toast.success(response.data.message);
        isDeleteDialogOpen.value = false;
        const isLastItemOnPage = entries.value.length === 1 && pagination.value.page > 1;
        await Promise.all([loadEntries(isLastItemOnPage ? pagination.value.page - 1 : pagination.value.page), refreshSettings()]);
    } catch (error) {
        toast.error('Alamat gagal dihapus', getErrorMessage(error));
    } finally {
        isDeleting.value = false;
    }
}

onMounted(() => loadEntries(1));
</script>

<template>
    <section class="rounded-3xl border border-ink-200/70 bg-surface p-6" aria-labelledby="ip-whitelist-heading">
        <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
                <span
                    class="grid size-9 shrink-0 place-items-center rounded-xl"
                    :class="isEnabled ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-500'"
                >
                    <Network class="size-4" aria-hidden="true" />
                </span>
                <div>
                    <h2 id="ip-whitelist-heading" class="font-display text-lg font-semibold text-ink-900">Whitelist IP</h2>
                    <p class="mt-1 text-sm text-ink-600">
                        <template v-if="isEnabled">
                            Aktif. Member hanya bisa masuk dan memakai panel dari alamat di bawah; yang berpindah ke jaringan
                            lain langsung keluar. Superadmin tetap bisa masuk dari mana saja.
                        </template>
                        <template v-else>
                            Mati. Member bisa masuk dari jaringan mana pun. Tambahkan alamat kantor dulu, lalu nyalakan.
                            Pencarian publik tidak pernah dibatasi.
                        </template>
                    </p>
                </div>
            </div>
            <SwitchRoot
                :model-value="isEnabled"
                :disabled="isSavingToggle || (!isEnabled && pagination.total === 0)"
                aria-labelledby="ip-whitelist-heading"
                class="relative mt-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-ink-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-success-600"
                @update:model-value="handleToggle"
            >
                <SwitchThumb
                    class="block size-5 translate-x-1 rounded-full bg-surface shadow-card transition-transform data-[state=checked]:translate-x-6"
                />
            </SwitchRoot>
        </div>

        <p class="mt-5 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
            IP Anda sekarang:
            <span class="font-mono font-medium text-ink-900">{{ settings.current_ip }}</span>
            <span v-if="settings.is_current_ip_whitelisted" class="text-success-700"> · sudah terdaftar</span>
            <span v-else class="text-ink-500"> · belum terdaftar</span>
        </p>

        <form class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start" novalidate @submit="addEntry">
            <AppInput
                v-model="entryValue"
                field-id="ip-entry-value"
                class="sm:flex-1"
                label="Alamat IP atau rentang CIDR"
                placeholder="103.10.20.0/24"
                :error="errors.value"
            >
                <template #append>
                    <button
                        v-if="!settings.is_current_ip_whitelisted"
                        type="button"
                        class="shrink-0 cursor-pointer rounded-lg border border-ink-200 px-3 text-xs font-medium whitespace-nowrap text-ink-700 hover:bg-ink-50"
                        @click="useCurrentIp"
                    >
                        Pakai IP saya
                    </button>
                </template>
            </AppInput>
            <AppInput
                v-model="entryLabel"
                field-id="ip-entry-label"
                class="sm:flex-1"
                label="Keterangan"
                placeholder="Kantor Surabaya"
                is-optional
                :error="errors.label"
            />
            <AppButton type="submit" class="sm:mt-6.5" :is-loading="isSubmitting">
                <Plus v-if="!isSubmitting" class="size-4" aria-hidden="true" />
                Tambah
            </AppButton>
        </form>

        <div class="mt-6">
            <div v-if="isLoadingEntries && entries.length === 0" class="h-16 animate-pulse rounded-2xl bg-ink-100" aria-busy="true" />
            <p v-else-if="entries.length === 0" class="rounded-2xl border border-dashed border-ink-300 px-4 py-6 text-center text-sm text-ink-500">
                Belum ada alamat di whitelist.
            </p>
            <ul v-else class="divide-y divide-ink-200/70 rounded-2xl border border-ink-200/70" aria-label="Daftar whitelist IP">
                <li v-for="entry in entries" :key="entry.id" class="flex items-center gap-3 px-4 py-3">
                    <div class="min-w-0 flex-1">
                        <p class="font-mono text-sm break-all text-ink-900">{{ entry.value }}</p>
                        <p v-if="entry.label" class="truncate text-xs text-ink-500">{{ entry.label }}</p>
                    </div>
                    <button
                        type="button"
                        class="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
                        :aria-label="`Hapus ${entry.value} dari whitelist`"
                        @click="askDelete(entry)"
                    >
                        <Trash2 class="size-4" aria-hidden="true" />
                    </button>
                </li>
            </ul>

            <div v-if="pagination.last_page > 1" class="mt-4">
                <AppPagination :page="pagination.page" :total="pagination.total" :per-page="pagination.per_page" @update:page="loadEntries" />
            </div>
        </div>

        <ConfirmDialog
            v-model:open="isConfirmEnableOpen"
            title="Nyalakan whitelist IP?"
            :description="`Member yang sedang memakai panel dari alamat di luar daftar (${pagination.total} alamat) akan langsung keluar dan tidak bisa masuk lagi dari jaringan itu.`"
            confirm-label="Ya, nyalakan"
            :is-processing="isSavingToggle"
            @confirm="saveEnabled(true)"
        />

        <ConfirmDialog
            v-model:open="isDeleteDialogOpen"
            title="Hapus alamat ini?"
            :description="`${entryPendingDeletion?.value ?? ''} dihapus dari whitelist. Member dari alamat ini tidak bisa masuk lagi selama whitelist aktif.`"
            :is-processing="isDeleting"
            @confirm="deleteEntry"
        />
    </section>
</template>
