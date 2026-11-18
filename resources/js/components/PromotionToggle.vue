<script setup>
import { ref } from 'vue';
import { SwitchRoot, SwitchThumb } from 'reka-ui';
import { Megaphone } from 'lucide-vue-next';
import http from '@/lib/http';
import { getErrorMessage } from '@/lib/apiErrors';
import { useToast } from '@/composables/useToast';

const props = defineProps({
    domain: { type: Object, required: true },
});

const emit = defineEmits(['updated']);

const toast = useToast();
const isSaving = ref(false);

async function setPromotion(isPromoted) {
    isSaving.value = true;

    try {
        const response = await http.put(`/domains/${props.domain.id}/promotion`, { is_promoted: isPromoted });
        emit('updated', response.data.data);
        toast.success(response.data.message);
    } catch (error) {
        toast.error('Status promosi gagal diubah', getErrorMessage(error));
    } finally {
        isSaving.value = false;
    }
}
</script>

<template>
    <section
        class="rounded-3xl border p-6 transition-colors"
        :class="domain.is_promoted ? 'border-brand-300/70 bg-linear-to-br from-brand-50 to-surface' : 'border-ink-200/70 bg-surface'"
        aria-labelledby="promotion-heading"
    >
        <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-3">
                <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                    <Megaphone class="size-4" aria-hidden="true" />
                </span>
                <div>
                    <h2 id="promotion-heading" class="font-display text-lg font-semibold text-ink-900">Promosikan link ini</h2>
                    <p class="mt-1 text-sm text-ink-500">
                        Saat kata kunci pencarian cocok, link ini bisa tampil di slot
                        <span class="font-medium text-brand-700">Promosi</span> paling atas. Bila ada beberapa link
                        promosi yang cocok, satu dipilih acak.
                    </p>
                </div>
            </div>
            <SwitchRoot
                :model-value="domain.is_promoted"
                :disabled="isSaving"
                aria-labelledby="promotion-heading"
                class="relative mt-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-ink-200 transition-colors disabled:cursor-wait disabled:opacity-60 data-[state=checked]:bg-brand-500"
                @update:model-value="setPromotion"
            >
                <SwitchThumb
                    class="block size-5 translate-x-1 rounded-full bg-surface shadow-card transition-transform data-[state=checked]:translate-x-6"
                />
            </SwitchRoot>
        </div>
    </section>
</template>
