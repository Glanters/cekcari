import { createApp } from 'vue';
import { createPinia } from 'pinia';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import relativeTime from 'dayjs/plugin/relativeTime';
import App from '@/App.vue';
import { APP_NAME } from '@/lib/brand';
import { installStaleBuildRecovery } from '@/lib/staleBuild';

/**
 * Langkah awal yang sama untuk SPA domain pencarian dan SPA domain panel.
 */
export function createSpa(router) {
    dayjs.extend(relativeTime);
    dayjs.locale('id');

    installStaleBuildRecovery(router);

    // Judul dari server sudah dioptimalkan untuk mesin pencari; halaman tanpa judul sendiri tetap memakainya.
    const serverTitle = document.title;

    router.afterEach((to) => {
        const appName = APP_NAME;
        document.title = to.meta.title ? `${to.meta.title} · ${appName}` : serverTitle;
    });

    createApp(App).use(createPinia()).use(router).mount('#app');
}
