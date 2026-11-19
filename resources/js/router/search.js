import { createRouter, createWebHistory } from 'vue-router';
// Beranda dan hasil pencarian ikut di bundel utama: halaman pertama tampil tanpa menunggu
// unduhan potongan kode kedua. Hanya halaman 404 yang jarang dibuka dimuat belakangan.
import SearchHomePage from '@/pages/SearchHomePage.vue';
import SearchResultsPage from '@/pages/SearchResultsPage.vue';

const routes = [
    {
        path: '/',
        name: 'home',
        component: SearchHomePage,
    },
    {
        path: '/cari',
        name: 'search',
        component: SearchResultsPage,
        meta: { title: 'Hasil pencarian' },
    },
    {
        path: '/pasang-aplikasi',
        name: 'install-guide',
        component: () => import('@/pages/InstallGuidePage.vue'),
        meta: { title: 'Cara pasang aplikasi' },
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
        meta: { title: 'Halaman tidak ditemukan' },
    },
];

export default createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior: () => ({ top: 0 }),
});
