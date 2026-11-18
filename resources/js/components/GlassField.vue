<script setup>
// Kolom kaca bercahaya emas untuk latar gelap: dipakai kolom pencarian pengunjung
// dan kolom "tempel link" di panel, supaya keduanya terasa satu produk.
defineProps({
    size: { type: String, default: 'md', validator: (value) => ['sm', 'md', 'lg'].includes(value) },
    hasError: { type: Boolean, default: false },
    // Kolom berisi beberapa baris (mis. daftar situs): sudut membulat lebih kecil, tombol tetap di baris terakhir.
    isMultiline: { type: Boolean, default: false },
});

const SIZE_CLASSES = {
    sm: 'h-12 gap-2 pr-1.5 pl-4',
    md: 'h-14 gap-3 pr-1.5 pl-5',
    lg: 'h-16 gap-3 pr-2 pl-6 sm:h-18 sm:pl-7',
};
</script>

<template>
    <div
        class="flex border bg-white/5 shadow-glass backdrop-blur-xl transition duration-300 hover:border-white/20 focus-within:bg-white/8 focus-within:shadow-glow"
        :class="[
            isMultiline ? 'min-h-14 items-end gap-3 rounded-3xl py-1.5 pr-1.5 pl-5' : ['items-center rounded-full', SIZE_CLASSES[size]],
            hasError ? 'border-danger-300/70' : 'border-white/10 focus-within:border-brand-400/60',
        ]"
    >
        <slot />
    </div>
</template>
