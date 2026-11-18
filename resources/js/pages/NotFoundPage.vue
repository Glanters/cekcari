<script setup>
import { Compass } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import EmptyState from '@/components/EmptyState.vue';
</script>

<template>
    <div class="grid min-h-screen place-items-center px-4">
        <EmptyState
            :icon="Compass"
            title="Halaman tidak ditemukan"
            description="Alamat yang Anda buka tidak tersedia. Kembali ke halaman utama."
        >
            <AppButton to="/">Ke halaman utama</AppButton>
        </EmptyState>
    </div>
</template>
