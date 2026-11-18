import { createSpa } from '@/lib/createSpa';
import { setupPwa } from '@/lib/pwa';
import router from '@/router/search';

setupPwa();
createSpa(router);
