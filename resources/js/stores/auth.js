import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import http, { ensureCsrfCookie } from '@/lib/http';

// Status jawaban login dari server; lihat SessionController.
export const LOGIN_STATUS = Object.freeze({
    authenticated: 'authenticated',
    twoFactorChallenge: 'two_factor_challenge',
    twoFactorSetup: 'two_factor_setup',
});

export const useAuthStore = defineStore('auth', () => {
    const currentUser = ref(null);
    const hasCheckedSession = ref(false);

    const isAuthenticated = computed(() => currentUser.value !== null);
    const isSuperadmin = computed(() => currentUser.value?.role === 'superadmin');

    async function loadSession() {
        if (hasCheckedSession.value) {
            return;
        }

        try {
            const response = await http.get('/profile');
            currentUser.value = response.data.data;
        } catch (error) {
            // 401 berarti pengunjung belum masuk, 403 berarti akunnya dinonaktifkan; selain itu diteruskan.
            if (![401, 403].includes(error.response?.status)) {
                throw error;
            }

            currentUser.value = null;
        } finally {
            hasCheckedSession.value = true;
        }
    }

    // Jawaban login bisa langsung masuk, atau meminta langkah 2FA dulu.
    function applyLoginResult(loginResult) {
        if (loginResult.status === LOGIN_STATUS.authenticated) {
            currentUser.value = loginResult.user;
        }

        return loginResult;
    }

    async function login(credentials) {
        await ensureCsrfCookie();
        const response = await http.post('/sessions', credentials);

        return applyLoginResult(response.data.data);
    }

    async function verifyTwoFactor(code) {
        const response = await http.post('/two-factor-challenges', { code });

        return applyLoginResult(response.data.data);
    }

    async function confirmTwoFactorSetup(code) {
        const response = await http.post('/two-factor-setups', { code });

        return applyLoginResult(response.data.data);
    }

    async function logout() {
        await http.delete('/sessions');
        clearSession();
    }

    function clearSession() {
        currentUser.value = null;
    }

    return {
        currentUser,
        hasCheckedSession,
        isAuthenticated,
        isSuperadmin,
        loadSession,
        login,
        verifyTwoFactor,
        confirmTwoFactorSetup,
        logout,
        clearSession,
    };
});
