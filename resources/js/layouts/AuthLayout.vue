<script setup>
import AppLogo from '@/components/AppLogo.vue';

defineProps({
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
});

// Urutan ini memang alur yang dialami pemilik situs, jadi ditampilkan bernomor.
const ONBOARDING_STEPS = [
    { title: 'Tempel link situs Anda', description: 'Satu kolom saja, tanpa formulir panjang.' },
    { title: 'Kami baca situsnya', description: 'Judul, deskripsi, tag, dan logo diambil otomatis.' },
    { title: 'Langsung bisa ditemukan', description: 'Situs dan halaman-halamannya tampil di pencarian CekCari.' },
];
</script>

<template>
    <div class="flex min-h-dvh flex-col lg:flex-row">
        <aside class="relative isolate overflow-hidden bg-hero px-6 py-8 sm:px-10 lg:flex lg:w-5/12 lg:flex-col lg:py-12">
            <div class="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" aria-hidden="true" />
            <AppLogo tone="light" />

            <div class="mt-8 lg:mt-auto lg:mb-auto">
                <p class="font-display text-2xl leading-tight font-semibold tracking-tight text-ink-50 sm:text-3xl lg:text-4xl">
                    Cukup tempel link.<br />
                    <span class="text-gold-gradient">Sisanya kami kerjakan.</span>
                </p>

                <ol class="mt-10 hidden flex-col gap-6 lg:flex">
                    <li v-for="(step, index) in ONBOARDING_STEPS" :key="step.title" class="flex gap-4">
                        <span
                            class="grid size-8 shrink-0 place-items-center rounded-full border border-brand-400/40 font-mono text-sm text-brand-300"
                            aria-hidden="true"
                        >
                            {{ index + 1 }}
                        </span>
                        <div>
                            <p class="font-medium text-ink-50">{{ step.title }}</p>
                            <p class="mt-0.5 text-sm text-ink-400">{{ step.description }}</p>
                        </div>
                    </li>
                </ol>
            </div>
        </aside>

        <div class="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 lg:justify-center lg:py-16">
            <main class="w-full max-w-md">
                <h1 class="font-display text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">{{ title }}</h1>
                <p v-if="subtitle" class="mt-2 text-ink-500">{{ subtitle }}</p>
                <div class="mt-8">
                    <slot />
                </div>
                <p class="mt-8 text-sm text-ink-500">
                    <slot name="footer" />
                </p>
            </main>
        </div>
    </div>
</template>
