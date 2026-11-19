<script setup>
import { computed, ref } from 'vue';
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { CircleCheck, Download, EllipsisVertical, Search, Share, SquarePlus } from 'lucide-vue-next';
import AppLogo from '@/components/AppLogo.vue';
import GoldButton from '@/components/GoldButton.vue';
import { deferredInstallPrompt, isRunningStandalone } from '@/lib/pwa';

// Tab yang terbuka mengikuti ponsel pengunjung; pengunjung tetap bisa membuka tab lainnya.
const isAppleDevice = /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
const platform = ref(isAppleDevice ? 'iphone' : 'android');
const isInstalled = isRunningStandalone();
const siteAddress = window.location.host;

const isInstalling = ref(false);
const canInstallDirectly = computed(() => deferredInstallPrompt.value !== null);

// Di Android, Chrome kadang menyediakan pemasangan langsung tanpa membuka menu.
async function installNow() {
    const promptEvent = deferredInstallPrompt.value;

    if (!promptEvent) {
        return;
    }

    isInstalling.value = true;

    try {
        await promptEvent.prompt();
        await promptEvent.userChoice;
    } finally {
        deferredInstallPrompt.value = null;
        isInstalling.value = false;
    }
}

const ANDROID_STEPS = [
    {
        icon: Search,
        title: 'Buka CekCari di Google Chrome',
        detail: `Ketik ${siteAddress} di kolom alamat Chrome.`,
    },
    {
        icon: EllipsisVertical,
        title: 'Ketuk menu ⋮ di pojok kanan atas',
        detail: 'Tombol tiga titik di samping kolom alamat.',
    },
    {
        icon: Download,
        title: 'Pilih “Instal aplikasi”',
        detail: 'Di sebagian ponsel tulisannya “Tambahkan ke layar utama”.',
    },
    {
        icon: CircleCheck,
        title: 'Ketuk “Instal” untuk mengonfirmasi',
        detail: 'Ikon CekCari muncul di layar utama dan di daftar aplikasi.',
    },
];

const IPHONE_STEPS = [
    {
        icon: Search,
        title: 'Buka CekCari di Safari',
        detail: `Ketik ${siteAddress} di kolom alamat Safari.`,
    },
    {
        icon: Share,
        title: 'Ketuk tombol Bagikan',
        detail: 'Ikon kotak dengan panah ke atas, di bawah layar (di iPad: kanan atas).',
    },
    {
        icon: SquarePlus,
        title: 'Pilih “Tambah ke Layar Utama”',
        detail: 'Gulir daftar pilihan ke bawah bila belum terlihat.',
    },
    {
        icon: CircleCheck,
        title: 'Ketuk “Tambah” di pojok kanan atas',
        detail: 'Ikon CekCari muncul di layar utama, siap dibuka seperti aplikasi lain.',
    },
];

const QUESTIONS = [
    {
        question: 'Perlu unduh dari Play Store atau App Store?',
        answer: 'Tidak. CekCari dipasang langsung dari browser, ukurannya kecil, dan selalu versi terbaru.',
    },
    {
        question: 'Pilihan “Instal aplikasi” atau “Tambah ke Layar Utama” tidak muncul?',
        answer:
            'Pastikan halaman dibuka di Chrome (Android) atau Safari (iPhone), bukan di dalam aplikasi lain seperti Instagram, Facebook, atau WhatsApp. Salin alamatnya, lalu buka di browser.',
    },
    {
        question: 'Bagaimana cara menghapusnya?',
        answer: 'Tekan lama ikon CekCari di layar utama, lalu pilih Hapus atau Uninstal, sama seperti aplikasi lain.',
    },
];

const TAB_TRIGGER_CLASSES =
    'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-full font-display text-sm font-semibold text-ink-300 transition-colors hover:text-ink-50 data-[state=active]:bg-linear-to-br data-[state=active]:from-brand-300 data-[state=active]:to-brand-500 data-[state=active]:text-ink-950';
</script>

<template>
    <div class="min-h-dvh">
        <header class="relative isolate overflow-hidden bg-hero">
            <div class="pointer-events-none absolute inset-0 -z-10 bg-grid-fade" aria-hidden="true" />
            <div class="mx-auto max-w-2xl px-4 pt-5 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
                <AppLogo tone="light" />
                <h1 class="mt-10 font-display text-3xl leading-tight font-semibold tracking-tight text-ink-50 sm:text-4xl">
                    Pasang CekCari di ponsel Anda
                </h1>
                <p class="mt-3 max-w-xl text-base leading-relaxed text-ink-300">
                    Buka CekCari langsung dari layar utama, seperti aplikasi biasa. Tanpa Play Store atau App Store,
                    cukup beberapa ketukan.
                </p>
            </div>
            <div class="h-px bg-linear-to-r from-transparent via-brand-400/60 to-transparent" aria-hidden="true" />
        </header>

        <main class="mx-auto max-w-2xl px-4 pt-8 pb-24 sm:px-6">
            <p
                v-if="isInstalled"
                class="mb-8 flex items-start gap-3 rounded-2xl bg-success-50 p-4 text-sm text-success-700"
                role="status"
            >
                <CircleCheck class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                CekCari sudah terpasang dan sedang Anda buka sebagai aplikasi.
            </p>

            <TabsRoot v-model="platform">
                <TabsList class="flex rounded-full bg-ink-900 p-1" aria-label="Pilih jenis ponsel">
                    <TabsTrigger value="android" :class="TAB_TRIGGER_CLASSES">Android</TabsTrigger>
                    <TabsTrigger value="iphone" :class="TAB_TRIGGER_CLASSES">iPhone &amp; iPad</TabsTrigger>
                </TabsList>

                <TabsContent value="android" class="mt-8 focus-visible:outline-none">
                    <div
                        v-if="canInstallDirectly"
                        class="mb-8 flex flex-col gap-3 rounded-2xl border border-brand-300/70 bg-linear-to-br from-brand-50 to-surface p-4 sm:flex-row sm:items-center"
                    >
                        <p class="flex-1 text-sm text-ink-700">
                            <span class="block font-semibold text-ink-900">Bisa langsung dipasang</span>
                            Browser Anda mendukung pemasangan sekali ketuk.
                        </p>
                        <GoldButton type="button" :is-loading="isInstalling" @click="installNow">
                            <Download v-if="!isInstalling" class="size-4" aria-hidden="true" />
                            Pasang sekarang
                        </GoldButton>
                    </div>

                    <ol class="flex flex-col gap-6">
                        <li v-for="(step, index) in ANDROID_STEPS" :key="step.title" class="flex gap-4">
                            <span
                                class="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 font-display text-sm font-semibold text-brand-300"
                                aria-hidden="true"
                            >
                                {{ index + 1 }}
                            </span>
                            <div class="pt-1.5">
                                <p class="flex items-center gap-2 font-semibold text-ink-900">
                                    <component :is="step.icon" class="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                                    {{ step.title }}
                                </p>
                                <p class="mt-1 text-sm leading-relaxed text-ink-600">{{ step.detail }}</p>
                            </div>
                        </li>
                    </ol>
                    <p class="mt-8 text-sm leading-relaxed text-ink-500">
                        Memakai Samsung Internet? Ketuk menu ≡ di bawah, pilih “Tambahkan halaman ke”, lalu “Layar
                        utama”.
                    </p>
                </TabsContent>

                <TabsContent value="iphone" class="mt-8 focus-visible:outline-none">
                    <ol class="flex flex-col gap-6">
                        <li v-for="(step, index) in IPHONE_STEPS" :key="step.title" class="flex gap-4">
                            <span
                                class="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 font-display text-sm font-semibold text-brand-300"
                                aria-hidden="true"
                            >
                                {{ index + 1 }}
                            </span>
                            <div class="pt-1.5">
                                <p class="flex items-center gap-2 font-semibold text-ink-900">
                                    <component :is="step.icon" class="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                                    {{ step.title }}
                                </p>
                                <p class="mt-1 text-sm leading-relaxed text-ink-600">{{ step.detail }}</p>
                            </div>
                        </li>
                    </ol>
                    <p class="mt-8 text-sm leading-relaxed text-ink-500">
                        Di iPhone, pemasangan paling lancar lewat Safari. Chrome dan browser lain di iOS 16.4 ke atas juga
                        punya “Tambah ke Layar Utama” di tombol Bagikan.
                    </p>
                </TabsContent>
            </TabsRoot>

            <section class="mt-14 border-t border-ink-200/80 pt-10" aria-labelledby="questions-heading">
                <h2 id="questions-heading" class="font-display text-xl font-semibold text-ink-900">Pertanyaan umum</h2>
                <dl class="mt-5 flex flex-col gap-5">
                    <div v-for="item in QUESTIONS" :key="item.question">
                        <dt class="font-semibold text-ink-900">{{ item.question }}</dt>
                        <dd class="mt-1 text-sm leading-relaxed text-ink-600">{{ item.answer }}</dd>
                    </div>
                </dl>
            </section>

            <RouterLink
                :to="{ name: 'home' }"
                class="mt-12 inline-flex items-center gap-2 text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
            >
                <Search class="size-4" aria-hidden="true" />
                Mulai mencari di CekCari
            </RouterLink>
        </main>
    </div>
</template>
