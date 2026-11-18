<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import AppLogo from '@/components/AppLogo.vue';
import InstallAppPrompt from '@/components/InstallAppPrompt.vue';
import SearchBox from '@/components/SearchBox.vue';

const router = useRouter();
const query = ref('');

function search(keyword) {
    router.push({ name: 'search', query: { q: keyword } });
}
</script>

<template>
    <main class="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-hero px-4 pb-24">
        <div class="pointer-events-none absolute inset-0 -z-20 bg-grid-fade" aria-hidden="true" />
        <div
            class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-linear-to-r from-transparent via-brand-400/50 to-transparent"
            aria-hidden="true"
        />

        <h1 class="sr-only">CekCari — mesin pencari situs</h1>

        <div class="relative flex w-full max-w-3xl flex-col items-center">
            <div
                class="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-120 -translate-x-1/2 -translate-y-1/2 sm:size-160 lg:size-190"
                aria-hidden="true"
            >
                <div class="lens-glass absolute inset-0 motion-safe:animate-lens-in" />
                <div class="lens-glint absolute inset-0 motion-safe:animate-orbit" />
                <div class="lens-glass absolute inset-16 opacity-40 sm:inset-24 lg:inset-28" />
                <div class="lens-handle absolute" />
            </div>

            <div class="motion-safe:animate-rise">
                <AppLogo size="lg" tone="light" />
            </div>

            <div class="mt-12 w-full max-w-2xl motion-safe:animate-rise motion-safe:animation-delay-1 sm:mt-14 lg:max-w-3xl">
                <SearchBox v-model:query="query" size="lg" is-autofocus @submit="search" />
            </div>
        </div>
        <InstallAppPrompt />
    </main>
</template>
