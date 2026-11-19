<script setup>
import { ChevronRight, Megaphone } from 'lucide-vue-next';
import HighlightedText from '@/components/HighlightedText.vue';
import SiteAddress from '@/components/SiteAddress.vue';
import { trackDomainClick } from '@/lib/analytics';
import { getLocalStorage } from '@/lib/pwa';

const props = defineProps({
    result: { type: Object, required: true },
    markers: { type: Object, required: true },
    // Hanya hasil pencarian sungguhan yang dihitung; pratinjau di panel tidak ikut tercatat.
    isTracked: { type: Boolean, default: false },
    isPromoted: { type: Boolean, default: false },
    // Nomor urut hasil (lanjut antarhalaman). Menggantikan favicon situs, yang sering gagal dimuat
    // dari situs pemiliknya dan membuat daftar tampak berantakan.
    position: { type: Number, default: null },
});

function recordClick() {
    if (props.isTracked) {
        trackDomainClick(getLocalStorage(), props.result.id, props.isPromoted);
    }
}

function pathOf(url) {
    const parsedUrl = new URL(url);

    return parsedUrl.pathname + parsedUrl.search;
}
</script>

<template>
    <!-- Di ponsel baris melebar sampai tepi agar umpan balik sentuh (latar emas tipis) terasa penuh. -->
    <article
        class="group relative -mx-4 px-4 py-6 transition-colors active:bg-brand-50/70 sm:mx-0 sm:px-0 sm:py-7 sm:active:bg-transparent"
    >
        <!-- Garis emas di kiri muncul saat disorot, menandai hasil yang sedang dibaca. -->
        <span
            class="absolute top-7 bottom-7 -left-5 hidden w-0.5 origin-top scale-y-0 rounded-full bg-brand-400 transition-transform duration-300 group-hover:scale-y-100 group-focus-within:scale-y-100 lg:block"
            aria-hidden="true"
        />

        <div class="flex items-center gap-3">
            <span
                v-if="isPromoted"
                class="grid size-7 shrink-0 place-items-center rounded-md bg-brand-200 text-brand-800"
                aria-hidden="true"
            >
                <Megaphone class="size-3.5" />
            </span>
            <span
                v-else-if="position !== null"
                class="grid h-7 min-w-7 shrink-0 place-items-center rounded-md bg-ink-100 px-1.5 font-mono text-xs font-semibold text-ink-600 tabular-nums"
            >
                <span class="sr-only">Hasil ke-</span>{{ position }}
            </span>
            <p class="min-w-0 truncate text-xs">
                <SiteAddress :url="result.url" scheme-visibility="desktop" />
            </p>
        </div>

        <h2 class="mt-3 font-display text-xl leading-snug font-semibold tracking-tight text-ink-950 sm:text-2xl">
            <a
                :href="result.url"
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                @click="recordClick"
                @auxclick="recordClick"
                class="decoration-brand-300 decoration-2 underline-offset-4 transition-colors after:absolute after:inset-0 hover:text-brand-700 hover:underline"
            >
                <HighlightedText :text="result.title" :markers="markers" />
            </a>
        </h2>

        <p class="mt-2 line-clamp-2 text-base leading-relaxed text-ink-600 sm:line-clamp-3">
            <HighlightedText :text="result.description" :markers="markers" />
        </p>

        <!-- Ponsel: daftar judul ringkas yang mudah disentuh. Layar lebar: dua kolom dengan cuplikan. -->
        <section
            v-if="result.related_pages.length"
            class="relative z-10 mt-4 rounded-2xl bg-ink-100/70 px-4 pt-3 pb-1 sm:mt-5 sm:rounded-none sm:border-l-2 sm:border-brand-200 sm:bg-transparent sm:py-0 sm:pr-0"
            :aria-label="`Halaman lain di ${result.host}`"
        >
            <p class="text-xs font-medium tracking-wider text-ink-500 uppercase sm:text-ink-400">Halaman lain di situs ini</p>
            <ul class="mt-1 divide-y divide-ink-200/80 sm:mt-3 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-4 sm:divide-y-0">
                <li v-for="page in result.related_pages" :key="page.url" class="min-w-0">
                    <a
                        :href="page.url"
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                        @click="recordClick"
                        @auxclick="recordClick"
                        class="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold text-ink-900 decoration-brand-300 underline-offset-4 hover:text-brand-700 active:text-brand-700 sm:block sm:min-h-0 sm:truncate sm:hover:underline"
                    >
                        <span class="truncate">{{ page.title || pathOf(page.url) }}</span>
                        <ChevronRight class="size-4 shrink-0 text-ink-400 sm:hidden" aria-hidden="true" />
                    </a>
                    <p class="mt-1 hidden text-sm text-ink-500 sm:line-clamp-2">
                        <HighlightedText :text="page.snippet" :markers="markers" />
                    </p>
                </li>
            </ul>
        </section>
    </article>
</template>
