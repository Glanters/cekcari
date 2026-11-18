<script setup>
import { APP_NAME } from '@/lib/brand';

defineProps({
    size: { type: String, default: 'md', validator: (value) => ['md', 'lg'].includes(value) },
    // "light" untuk latar gelap (halaman pengunjung), "dark" untuk latar terang (panel).
    tone: { type: String, default: 'dark', validator: (value) => ['light', 'dark'].includes(value) },
    // Di ponsel hanya ikon yang tampil (lebih besar agar mudah disentuh) supaya header muat satu baris.
    isMarkOnlyOnMobile: { type: Boolean, default: false },
});

const appName = APP_NAME;
</script>

<template>
    <RouterLink
        to="/"
        class="group inline-flex items-center rounded-xl font-display font-semibold tracking-tight"
        :class="size === 'lg' ? 'gap-4' : 'gap-2.5'"
        :aria-label="`${appName} — halaman utama`"
    >
        <!-- Logo resmi CekCari; teks alternatif kosong karena nama aplikasi sudah ada di aria-label tautan. -->
        <img
            src="/images/brand/cekcari-logo-128.png"
            srcset="/images/brand/cekcari-logo-128.png 1x, /images/brand/cekcari-logo-256.png 2x"
            width="128"
            height="128"
            alt=""
            class="shrink-0 drop-shadow-lg transition-transform duration-300 motion-safe:group-hover:scale-105"
            :class="[size === 'lg' ? 'size-16 sm:size-20 lg:size-24' : 'size-10', { 'max-sm:size-12': isMarkOnlyOnMobile }]"
        />
        <span
            :class="[
                size === 'lg' ? 'text-5xl sm:text-6xl' : 'text-xl',
                tone === 'light' ? 'text-ink-50' : 'text-ink-900',
                { 'max-sm:sr-only': isMarkOnlyOnMobile },
            ]"
        >
            Cek<span :class="tone === 'light' ? 'text-gold-gradient' : 'text-brand-600'">Cari</span>
        </span>
    </RouterLink>
</template>
