<script setup>
import { computed, ref } from 'vue';
import { useForm } from 'vee-validate';
import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { combine, isOneTimeCode, isRequired } from '@/lib/validators';

const props = defineProps({
    // "challenge" = akun sudah memasang 2FA; "setup" = konfirmasi pemasangan pertama.
    mode: { type: String, required: true, validator: (value) => ['challenge', 'setup'].includes(value) },
});

const emit = defineEmits(['authenticated', 'expired']);

const authStore = useAuthStore();
const toast = useToast();
const isUsingRecoveryCode = ref(false);

const { defineField, errors, handleSubmit, isSubmitting, setErrors, resetForm } = useForm({
    validationSchema: {
        code: (value) =>
            isUsingRecoveryCode.value ? isRequired('Recovery code')(value) : combine(isRequired('Kode'), isOneTimeCode)(value),
    },
    initialValues: { code: '' },
});

const [code] = defineField('code');

const fieldLabel = computed(() => (isUsingRecoveryCode.value ? 'Recovery code' : 'Kode 6 angka'));
const fieldHint = computed(() =>
    isUsingRecoveryCode.value
        ? 'Salah satu kode cadangan yang Anda simpan saat memasang 2FA. Tiap kode hanya berlaku sekali.'
        : 'Buka Google Authenticator atau Authy, lalu ketik kode untuk CekCari.',
);

function toggleRecoveryCode() {
    isUsingRecoveryCode.value = !isUsingRecoveryCode.value;
    resetForm({ values: { code: '' } });
}

const submit = handleSubmit(async (values) => {
    const typedCode = isUsingRecoveryCode.value ? values.code.trim() : values.code.replace(/\s/g, '');

    try {
        const loginResult =
            props.mode === 'setup'
                ? await authStore.confirmTwoFactorSetup(typedCode)
                : await authStore.verifyTwoFactor(typedCode);

        emit('authenticated', loginResult);
    } catch (error) {
        // 410/429: langkah login berakhir (kedaluwarsa atau kode salah terlalu sering), jadi harus mulai lagi.
        if ([410, 429].includes(error.response?.status)) {
            emit('expired', getErrorMessage(error));

            return;
        }

        setErrors(getFieldErrors(error));

        if (error.response?.status !== 422) {
            toast.error('Kode gagal diperiksa', getErrorMessage(error));
        }
    }
});
</script>

<template>
    <form class="flex flex-col gap-4" novalidate @submit="submit">
        <AppInput
            v-model="code"
            field-id="two-factor-code"
            :label="fieldLabel"
            :hint="fieldHint"
            :error="errors.code"
            :input-mode="isUsingRecoveryCode ? null : 'numeric'"
            :autocomplete="isUsingRecoveryCode ? 'off' : 'one-time-code'"
            :placeholder="isUsingRecoveryCode ? 'abcde-12345' : '123456'"
        />
        <AppButton type="submit" class="w-full" :is-loading="isSubmitting">
            {{ mode === 'setup' ? 'Aktifkan 2FA dan masuk' : 'Masuk' }}
        </AppButton>
        <button
            v-if="mode === 'challenge'"
            type="button"
            class="cursor-pointer self-center rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:underline"
            @click="toggleRecoveryCode"
        >
            {{ isUsingRecoveryCode ? 'Pakai kode dari aplikasi authenticator' : 'Ponsel hilang? Pakai recovery code' }}
        </button>
    </form>
</template>
