import { createRouter, createWebHistory } from 'vue-router';

const routes = [
    {
        path: '/',
        name: 'home',
        component: () => import('@/pages/SearchHomePage.vue'),
    },
    {
        path: '/cari',
        name: 'search',
        component: () => import('@/pages/SearchResultsPage.vue'),
        meta: { title: 'Hasil pencarian' },
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
