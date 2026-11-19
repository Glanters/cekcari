<script setup>
import { computed } from 'vue';
import { ChevronRight } from 'lucide-vue-next';
import DomainAvatar from '@/components/DomainAvatar.vue';
import HighlightedText from '@/components/HighlightedText.vue';
import { trackDomainClick } from '@/lib/analytics';
import { stripHighlightMarkers } from '@/lib/highlight';
import { breadcrumbOf, siteNameOf } from '@/lib/siteAddress';
import { getLocalStorage } from '@/lib/pwa';

const props = defineProps({
    result: { type: Object, required: true },
    markers: { type: Object, required: true },
    // Hanya hasil pencarian sungguhan yang dihitung; pratinjau di panel tidak ikut tercatat.
    isTracked: { type: Boolean, default: false },
    isPromoted: { type: Boolean, default: false },
});

function recordClick() {
    if (props.isTracked) {
        trackDomainClick(getLocalStorage(), props.result.id, props.isPromoted);
    }
}

const plainTitle = computed(() => stripHighlightMarkers(props.result.title, props.markers.start, props.markers.end));
const siteName = computed(() => siteNameOf(plainTitle.value, props.result.url));
const breadcrumb = computed(() => breadcrumbOf(props.result.url));

function pathOf(url) {
    const parsedUrl = new URL(url);

    return parsedUrl.pathname + parsedUrl.search;
}
</script>

<template>
    <!-- Ringkas seperti mesin pencari umum: ikon + nama situs + alamat, judul, lalu dua baris deskripsi.
         Di ponsel baris melebar sampai tepi agar umpan balik sentuh (latar emas tipis) terasa penuh. -->
    <article
        class="group relative -mx-4 px-4 py-4 transition-colors active:bg-brand-50/70 sm:mx-0 sm:px-0 sm:active:bg-transparent"
    >
        <!-- Garis emas di kiri muncul saat disorot, menandai hasil yang sedang dibaca. -->
        <span
            class="absolute top-4 bottom-4 -left-5 hidden w-0.5 origin-top scale-y-0 rounded-full bg-brand-400 transition-transform duration-300 group-hover:scale-y-100 group-focus-within:scale-y-100 lg:block"
            aria-hidden="true"
        />

        <div class="flex items-center gap-3">
            <DomainAvatar :logo-url="result.logo_url" :name="plainTitle" size="sm" is-round />
            <div class="min-w-0 leading-tight">
                <p class="truncate text-sm text-ink-900">{{ siteName }}</p>
                <p class="truncate text-xs text-ink-500">{{ breadcrumb }}</p>
            </div>
        </div>

        <h2 class="mt-2 font-display text-lg leading-snug font-medium text-ink-950 sm:text-xl">
            <a
                :href="result.url"
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                @click="recordClick"
                @auxclick="recordClick"
                class="decoration-brand-300 underline-offset-4 transition-colors after:absolute after:inset-0 hover:text-brand-700 hover:underline"
            >
                <HighlightedText :text="result.title" :markers="markers" />
            </a>
        </h2>

        <p class="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-600">
            <HighlightedText :text="result.description" :markers="markers" />
        </p>

        <!-- Ponsel: daftar judul ringkas yang mudah disentuh. Layar lebar: dua kolom dengan cuplikan. -->
        <section
            v-if="result.related_pages.length"
            class="relative z-10 mt-2 rounded-2xl bg-ink-100/70 px-4 py-1 sm:mt-3 sm:rounded-none sm:border-l-2 sm:border-brand-200 sm:bg-transparent sm:py-0 sm:pr-0"
            :aria-label="`Halaman lain di ${result.host}`"
        >
            <ul class="divide-y divide-ink-200/80 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-2 sm:divide-y-0">
                <li v-for="page in result.related_pages" :key="page.url" class="min-w-0">
                    <a
                        :href="page.url"
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                        @click="recordClick"
                        @auxclick="recordClick"
                        class="flex min-h-11 items-center justify-between gap-3 text-sm font-medium text-ink-900 decoration-brand-300 underline-offset-4 hover:text-brand-700 active:text-brand-700 sm:block sm:min-h-0 sm:truncate sm:hover:underline"
                    >
                        <span class="truncate">{{ page.title || pathOf(page.url) }}</span>
                        <ChevronRight class="size-4 shrink-0 text-ink-400 sm:hidden" aria-hidden="true" />
                    </a>
                    <p class="mt-0.5 hidden text-xs leading-relaxed text-ink-500 sm:line-clamp-2">
                        <HighlightedText :text="page.snippet" :markers="markers" />
                    </p>
                </li>
            </ul>
        </section>
    </article>
</template>
