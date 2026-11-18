<script setup>
import { computed, ref } from 'vue';
import { useForm } from 'vee-validate';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, ShieldAlert } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import RecoveryCodesPanel from '@/components/RecoveryCodesPanel.vue';
import TwoFactorCodeForm from '@/components/TwoFactorCodeForm.vue';
import TwoFactorSetupGuide from '@/components/TwoFactorSetupGuide.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import { LOGIN_STATUS, useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { combine, isEmail, isRequired } from '@/lib/validators';

// Urutan langkah login: kredensial Account Center → (pasang 2FA → recovery code) atau (kode 2FA).
const STEP = Object.freeze({
    credentials: 'credentials',
    challenge: 'challenge',
    setup: 'setup',
    recoveryCodes: 'recovery-codes',
});

const STEP_TEXT = {
    [STEP.credentials]: {
        title: 'Masuk ke panel CekCari',
        subtitle: 'Gunakan email dan kata sandi Account Center Anda.',
    },
    [STEP.challenge]: {
        title: 'Verifikasi dua langkah',
        subtitle: 'Masukkan kode dari aplikasi authenticator di ponsel Anda.',
    },
    [STEP.setup]: {
        title: 'Pasang verifikasi dua langkah',
        subtitle: 'Akun panel CekCari wajib memakai 2FA. Cukup sekali, sekitar satu menit.',
    },
    [STEP.recoveryCodes]: {
        title: '2FA sudah aktif',
        subtitle: 'Satu langkah lagi: simpan recovery code Anda.',
    },
};

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const step = ref(STEP.credentials);
const blockedMessage = ref('');
const twoFactorSetup = ref(null);
const recoveryCodes = ref([]);
const stepText = computed(() => STEP_TEXT[step.value]);

const { defineField, errors, handleSubmit, isSubmitting, setErrors, setFieldValue } = useForm({
    validationSchema: {
        email: combine(isRequired('Email'), isEmail),
        password: isRequired('Kata sandi'),
    },
    initialValues: { email: '', password: '' },
});

const [email] = defineField('email');
const [password] = defineField('password');

// Hanya jalur internal yang diterima agar parameter "kembali" tidak bisa dipakai mengalihkan ke situs lain.
function safeRedirectPath() {
    const target = String(route.query.kembali ?? '');

    // "/\\evil.com" dibaca browser sama dengan "//evil.com", jadi garis miring terbalik juga ditolak.
    const isInternalPath = target.startsWith('/') && !target.startsWith('//') && !target.includes('\\');

    return isInternalPath ? target : { name: 'domains.index' };
}

function enterDashboard() {
    toast.success('Selamat datang', authStore.currentUser?.name ?? '');
    router.push(safeRedirectPath());
}

function handleLoginResult(loginResult) {
    if (loginResult.status === LOGIN_STATUS.twoFactorChallenge) {
        step.value = STEP.challenge;
    } else if (loginResult.status === LOGIN_STATUS.twoFactorSetup) {
        twoFactorSetup.value = loginResult.two_factor_setup;
        step.value = STEP.setup;
    } else if (loginResult.recovery_codes?.length) {
        recoveryCodes.value = loginResult.recovery_codes;
        step.value = STEP.recoveryCodes;
    } else {
        enterDashboard();
    }
}

function restartLogin(message) {
    step.value = STEP.credentials;
    twoFactorSetup.value = null;
    setFieldValue('password', '');

    if (message) {
        toast.info('Silakan masuk ulang', message);
    }
}

const submitCredentials = handleSubmit(async (values) => {
    blockedMessage.value = '';

    try {
        handleLoginResult(await authStore.login(values));
    } catch (error) {
        // 403: akun sah di Account Center tetapi belum diaktifkan superadmin CekCari.
        if (error.response?.status === 403) {
            blockedMessage.value = getErrorMessage(error);

            return;
        }

        setErrors(getFieldErrors(error));

        if (error.response?.status !== 422) {
            toast.error('Gagal masuk', getErrorMessage(error));
        }
    }
});
</script>

<template>
    <AuthLayout :title="stepText.title" :subtitle="stepText.subtitle">
        <template v-if="step === STEP.credentials">
            <div
                v-if="blockedMessage"
                class="mb-5 flex gap-3 rounded-2xl border border-warning-600/20 bg-warning-50 p-4 text-sm text-ink-700"
                role="alert"
            >
                <ShieldAlert class="mt-0.5 size-5 shrink-0 text-warning-700" aria-hidden="true" />
                <p>{{ blockedMessage }}</p>
            </div>

            <form class="flex flex-col gap-4" novalidate @submit="submitCredentials">
                <AppInput
                    v-model="email"
                    field-id="email"
                    label="Email Account Center"
                    type="email"
                    autocomplete="username"
                    :error="errors.email"
                />
                <AppInput
                    v-model="password"
                    field-id="password"
                    label="Kata sandi"
                    type="password"
                    autocomplete="current-password"
                    :error="errors.password"
                />
                <AppButton type="submit" class="mt-2 w-full" :is-loading="isSubmitting">Masuk</AppButton>
            </form>
        </template>

        <TwoFactorCodeForm
            v-else-if="step === STEP.challenge"
            mode="challenge"
            @authenticated="handleLoginResult"
            @expired="restartLogin"
        />

        <div v-else-if="step === STEP.setup" class="flex flex-col gap-6">
            <TwoFactorSetupGuide :qr-code="twoFactorSetup.qr_code" :secret="twoFactorSetup.secret" />
            <TwoFactorCodeForm mode="setup" @authenticated="handleLoginResult" @expired="restartLogin" />
        </div>

        <RecoveryCodesPanel v-else :codes="recoveryCodes" @continue="enterDashboard" />

        <template #footer>
            <template v-if="step === STEP.credentials">
                Akun dibuat lewat Account Center. Setelah masuk pertama kali, minta superadmin CekCari mengaktifkan akun Anda.
            </template>
            <button
                v-else-if="step !== STEP.recoveryCodes"
                type="button"
                class="inline-flex cursor-pointer items-center gap-1.5 font-medium text-ink-600 hover:text-ink-900"
                @click="restartLogin()"
            >
                <ArrowLeft class="size-4" aria-hidden="true" />
                Masuk dengan akun lain
            </button>
        </template>
    </AuthLayout>
</template>
