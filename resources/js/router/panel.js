import { createRouter, createWebHistory } from 'vue-router';
import { onUnauthorized } from '@/lib/http';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const routes = [
    { path: '/', redirect: { name: 'domains.index' } },
    {
        path: '/masuk',
        name: 'login',
        component: () => import('@/pages/LoginPage.vue'),
        meta: { isGuestOnly: true, title: 'Masuk' },
    },
    {
        path: '/dasbor',
        component: () => import('@/layouts/DashboardLayout.vue'),
        meta: { requiresAuth: true },
        children: [
            { path: '', redirect: { name: 'domains.index' } },
            {
                path: 'domain',
                name: 'domains.index',
                component: () => import('@/pages/DomainListPage.vue'),
                meta: { title: 'Domain saya' },
            },
            {
                path: 'domain/:id',
                name: 'domains.show',
                component: () => import('@/pages/DomainDetailPage.vue'),
                props: true,
                meta: { title: 'Kelola domain' },
            },
            {
                path: 'pengguna',
                name: 'users.index',
                component: () => import('@/pages/UserListPage.vue'),
                meta: { title: 'Pengguna', requiresSuperadmin: true },
            },
            {
                path: 'keamanan',
                name: 'security',
                component: () => import('@/pages/SecuritySettingPage.vue'),
                meta: { title: 'Keamanan', requiresSuperadmin: true },
            },
        ],
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
        meta: { title: 'Halaman tidak ditemukan' },
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
    const authStore = useAuthStore();

    if (to.meta.requiresAuth || to.meta.isGuestOnly) {
        await authStore.loadSession();
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: { kembali: to.fullPath } };
    }

    // Tombolnya disembunyikan untuk member, tetapi alamatnya tetap bisa diketik; server juga menolak dengan 403.
    if (to.meta.requiresSuperadmin && !authStore.isSuperadmin) {
        return { name: 'domains.index' };
    }

    if (to.meta.isGuestOnly && authStore.isAuthenticated) {
        return { name: 'domains.index' };
    }

    return true;
});

// Sesi bisa kedaluwarsa atau diputus server saat user sedang di dasbor; arahkan kembali ke halaman masuk.
onUnauthorized((message) => {
    const authStore = useAuthStore();
    authStore.clearSession();

    if (message) {
        useToast().error('Sesi Anda diakhiri', message);
    }

    if (router.currentRoute.value.meta.requiresAuth) {
        router.push({ name: 'login', query: { kembali: router.currentRoute.value.fullPath } });
    }
});

export default router;
