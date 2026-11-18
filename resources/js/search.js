import { createSpa } from '@/lib/createSpa';
import { trackVisit } from '@/lib/analytics';
import { getLocalStorage, setupPwa } from '@/lib/pwa';
import router from '@/router/search';

setupPwa();

// Setiap halaman yang dibuka pengunjung dihitung sebagai satu kunjungan.
router.afterEach((to, from, failure) => {
    if (!failure) {
        trackVisit(getLocalStorage());
    }
});

createSpa(router);
