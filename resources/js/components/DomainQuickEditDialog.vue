<script setup>
import { ref, watch } from 'vue';
import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
} from 'reka-ui';
import { ArrowRight, X } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import DomainAvatar from '@/components/DomainAvatar.vue';
import PromotionToggle from '@/components/PromotionToggle.vue';
import SiteAddress from '@/components/SiteAddress.vue';
import StatusBadge from '@/components/StatusBadge.vue';
import http from '@/lib/http';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { isValidSiteAddress } from '@/lib/validators';
import { useToast } from '@/composables/useToast';

const props = defineProps({
    domain: { type: Object, default: null },
});

const emit = defineEmits(['updated']);
const isOpen = defineModel('open', { type: Boolean, default: false });

const toast = useToast();
const linkValue = ref('');
const linkError = ref('');
const isSavingLink = ref(false);

watch(
    () => props.domain?.id,
    () => {
        linkValue.value = props.domain?.url ?? '';
        linkError.value = '';
    },
    { immediate: true },
);

async function saveLink() {
    const validation = isValidSiteAddress(linkValue.value);

    if (validation !== true) {
        linkError.value = validation;

        return;
    }

    isSavingLink.value = true;
    linkError.value = '';

    try {
        const response = await http.put(`/domains/${props.domain.id}`, { url: linkValue.value.trim() });
        emit('updated', response.data.data);
        linkValue.value = response.data.data.url;
        toast.success('Link diganti', 'Data situs sudah diambil ulang dari link baru.');
    } catch (error) {
        linkError.value = getFieldErrors(error).url ?? getErrorMessage(error);
    } finally {
        isSavingLink.value = false;
    }
}
</script>

<template>
    <DialogRoot v-model:open="isOpen">
        <DialogPortal>
            <DialogOverlay class="fixed inset-0 z-40 bg-ink-950/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
            <DialogContent
                v-if="domain"
                class="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-dialog max-w-lg -translate-y-1/2 overflow-y-auto rounded-3xl bg-canvas shadow-popover data-[state=open]:animate-fade-in"
            >
                <div class="flex items-start gap-4 border-b border-ink-200/70 bg-surface p-5 sm:p-6">
                    <DomainAvatar :logo-url="domain.logo_url" :name="domain.title" />
                    <div class="min-w-0 flex-1">
                        <DialogTitle class="line-clamp-2 font-display text-lg leading-snug font-semibold text-ink-950">
                            {{ domain.title }}
                        </DialogTitle>
                        <DialogDescription class="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <SiteAddress :url="domain.url" class="truncate" />
                            <StatusBadge :status="domain.crawl_status" />
                        </DialogDescription>
                    </div>
                    <DialogClose
                        class="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                        aria-label="Tutup"
                    >
                        <X class="size-4" />
                    </DialogClose>
                </div>

                <div class="flex flex-col gap-5 p-5 sm:p-6">
                    <form class="flex flex-col gap-2" novalidate @submit.prevent="saveLink">
                        <AppInput
                            v-model="linkValue"
                            field-id="quick-edit-url"
                            label="Link situs"
                            placeholder="psms.com"
                            autocomplete="url"
                            hint="Data dan halaman situs dibaca ulang dari link baru."
                            :error="linkError"
                        >
                            <template #append>
                                <AppButton
                                    type="submit"
                                    :is-loading="isSavingLink"
                                    :is-disabled="linkValue.trim() === domain.url"
                                >
                                    {{ isSavingLink ? 'Membaca…' : 'Simpan' }}
                                </AppButton>
                            </template>
                        </AppInput>
                    </form>

                    <PromotionToggle :domain="domain" @updated="emit('updated', $event)" />

                    <RouterLink
                        :to="{ name: 'domains.show', params: { id: domain.id } }"
                        class="inline-flex items-center gap-1.5 self-start text-sm font-medium text-brand-700 hover:underline"
                    >
                        Buka halaman detail
                        <ArrowRight class="size-4" aria-hidden="true" />
                    </RouterLink>
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
