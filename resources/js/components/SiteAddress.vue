<script setup>
import { computed } from 'vue';
import { splitSiteUrl } from '@/lib/siteAddress';

const props = defineProps({
    url: { type: String, required: true },
    // "desktop": skema (https://) hanya tampil di layar lebar; di ponsel ruangnya dipakai untuk host dan path.
    schemeVisibility: { type: String, default: 'never', validator: (value) => ['never', 'desktop'].includes(value) },
});

const address = computed(() => splitSiteUrl(props.url));
</script>

<template>
    <span class="font-mono"
        ><span v-if="schemeVisibility === 'desktop'" class="hidden text-ink-400 sm:inline">{{ address.scheme }}</span
        ><span class="font-medium text-ink-700">{{ address.host }}</span
        ><span v-if="address.path" class="text-ink-400">{{ address.path }}</span></span
    >
</template>
