<script setup>
import { computed } from 'vue';
import { splitHighlightedText } from '@/lib/highlight';

const props = defineProps({
    text: { type: String, default: '' },
    markers: { type: Object, required: true },
});

const segments = computed(() => splitHighlightedText(props.text, props.markers.start, props.markers.end));
</script>

<template>
    <template v-for="(segment, index) in segments" :key="index">
        <mark v-if="segment.isHighlighted" class="highlight-marker bg-transparent">{{ segment.text }}</mark>
        <template v-else>{{ segment.text }}</template>
    </template>
</template>
