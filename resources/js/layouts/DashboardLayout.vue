<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Globe, LogOut, ShieldCheck, Users } from 'lucide-vue-next';
import AppLogo from '@/components/AppLogo.vue';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { getErrorMessage } from '@/lib/apiErrors';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();
const isLoggingOut = ref(false);

const NAV_ITEMS = [
    { label: 'Domain saya', icon: Globe, to: { name: 'domains.index' }, section: 'domains.', isSuperadminOnly: false },
    { label: 'Pengguna', icon: Users, to: { name: 'users.index' }, section: 'users.', isSuperadminOnly: true },
    { label: 'Keamanan', icon: ShieldCheck, to: { name: 'security' }, section: 'security', isSuperadminOnly: true },
];

const visibleNavItems = computed(() => NAV_ITEMS.filter((item) => !item.isSuperadminOnly || authStore.isSuperadmin));

// Daftar dan detail domain sama-sama berada di menu "Domain saya".
function isActiveSection(item) {
    return String(route.name ?? '').startsWith(item.section);
}

const initials = computed(() =>
    (authStore.currentUser?.name ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join(''),
);

async function logout() {
    isLoggingOut.value = true;

    try {
        await authStore.logout();
        toast.info('Anda sudah keluar');
        router.push({ name: 'login' });
    } catch (error) {
        toast.error('Gagal keluar', getErrorMessage(error));
    } finally {
        isLoggingOut.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-dvh flex-col">
        <header class="bg-ink-950">
            <div class="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
                <AppLogo tone="light" />

                <nav class="flex items-center gap-1" aria-label="Menu panel">
                    <RouterLink
                        v-for="item in visibleNavItems"
                        :key="item.label"
                        :to="item.to"
                        class="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors hover:bg-white/5 hover:text-ink-50"
                        :class="isActiveSection(item) ? 'bg-white/10 text-ink-50' : 'text-ink-400'"
                        :aria-current="isActiveSection(item) ? 'page' : undefined"
                        :aria-label="item.label"
                    >
                        <component :is="item.icon" class="size-4" aria-hidden="true" />
                        <span class="hidden sm:inline">{{ item.label }}</span>
                    </RouterLink>
                </nav>

                <div class="ml-auto flex items-center gap-2">
                    <div class="hidden items-center gap-2.5 md:flex">
                        <span
                            class="grid size-8 place-items-center rounded-full bg-linear-to-br from-brand-200 to-brand-500 font-display text-xs font-semibold text-ink-950"
                            aria-hidden="true"
                        >
                            {{ initials }}
                        </span>
                        <span class="flex max-w-44 flex-col leading-tight">
                            <span class="truncate text-sm text-ink-300">{{ authStore.currentUser?.name }}</span>
                            <span v-if="authStore.isSuperadmin" class="text-xs text-brand-300">Superadmin</span>
                        </span>
                    </div>
                    <span class="mx-1 hidden h-5 w-px bg-white/10 md:block" aria-hidden="true" />
                    <button
                        type="button"
                        class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-50 disabled:opacity-60"
                        :disabled="isLoggingOut"
                        aria-label="Keluar"
                        @click="logout"
                    >
                        <LogOut class="size-4" aria-hidden="true" />
                        <span class="hidden sm:inline">Keluar</span>
                    </button>
                </div>
            </div>
            <div class="h-px bg-linear-to-r from-transparent via-brand-400/50 to-transparent" aria-hidden="true" />
        </header>

        <main class="flex-1">
            <RouterView />
        </main>
    </div>
</template>
