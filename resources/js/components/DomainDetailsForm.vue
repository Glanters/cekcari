<script setup>
import { computed, ref, watch } from 'vue';
import { TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText, TagsInputRoot } from 'reka-ui';
import { PenLine, X } from 'lucide-vue-next';
import AppButton from '@/components/AppButton.vue';
import AppInput from '@/components/AppInput.vue';
import FormField from '@/components/FormField.vue';
import http from '@/lib/http';
import { getErrorMessage, getFieldErrors } from '@/lib/apiErrors';
import { useToast } from '@/composables/useToast';

// Sama dengan batas di server (SiteMetadataFetcher.ts).
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_TAGS = 10;

const props = defineProps({
    domain: { type: Object, required: true },
});

const emit = defineEmits(['updated']);

const toast = useToast();
const description = ref('');
const tags = ref([]);
const errors = ref({});
const isSaving = ref(false);

// Formulir diisi ulang dari data server setiap kali deskripsi/tag di server berubah (mis. selesai crawl).
watch(
    () => [props.domain.id, props.domain.description, props.domain.tags.join('\n')],
    () => {
        description.value = props.domain.description ?? '';
        tags.value = [...props.domain.tags];
        errors.value = {};
    },
    { immediate: true },
);

const isChanged = computed(
    () =>
        description.value.trim() !== (props.domain.description ?? '') ||
        tags.value.join('\n') !== props.domain.tags.join('\n'),
);

const editedNote = computed(() => {
    const editedParts = [
        props.domain.is_description_edited ? 'Deskripsi' : null,
        props.domain.is_tags_edited ? 'tag' : null,
    ].filter(Boolean);

    return editedParts.length ? `${editedParts.join(' dan ')} sudah Anda atur sendiri, tidak ditimpa saat data situs dibaca ulang.` : '';
});

async function save() {
    isSaving.value = true;
    errors.value = {};

    try {
        const response = await http.put(`/domains/${props.domain.id}/details`, {
            description: description.value.trim(),
            tags: tags.value,
        });
        emit('updated', response.data.data);
        toast.success(response.data.message);
    } catch (error) {
        errors.value = getFieldErrors(error);

        if (error.response?.status !== 422) {
            toast.error('Deskripsi dan tag gagal disimpan', getErrorMessage(error));
        }
    } finally {
        isSaving.value = false;
    }
}
</script>

<template>
    <form
        class="rounded-3xl border border-ink-200/70 bg-surface p-6"
        novalidate
        aria-labelledby="details-heading"
        @submit.prevent="save"
    >
        <div class="flex items-start gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <PenLine class="size-4" aria-hidden="true" />
            </span>
            <div>
                <h2 id="details-heading" class="font-display text-lg font-semibold text-ink-900">Deskripsi dan tag</h2>
                <p class="mt-1 text-sm text-ink-500">
                    Deskripsi tampil di bawah judul pada hasil pencarian. Tag tidak ditampilkan, tetapi membantu link ini
                    ditemukan lewat kata tersebut.
                </p>
            </div>
        </div>

        <div class="mt-5 flex flex-col gap-5">
            <AppInput
                v-model="description"
                field-id="details-description"
                label="Deskripsi"
                is-multiline
                :max-length="MAX_DESCRIPTION_LENGTH"
                placeholder="Jelaskan isi situs ini dalam satu atau dua kalimat."
                :error="errors.description"
            />

            <FormField
                label="Tag"
                field-id="details-tags"
                is-optional
                :error="errors.tags"
                :hint="`Tekan Enter atau koma setelah setiap tag. Paling banyak ${MAX_TAGS} tag.`"
            >
                <TagsInputRoot
                    v-model="tags"
                    :max="MAX_TAGS"
                    add-on-paste
                    add-on-blur
                    class="flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5 transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100"
                    :class="errors.tags ? 'border-danger-600' : 'border-ink-200'"
                >
                    <TagsInputItem
                        v-for="tag in tags"
                        :key="tag"
                        :value="tag"
                        class="inline-flex items-center gap-1 rounded-full bg-ink-100 py-1 pr-1 pl-3 text-sm text-ink-800 data-[state=active]:ring-2 data-[state=active]:ring-brand-300"
                    >
                        <TagsInputItemText />
                        <TagsInputItemDelete
                            class="grid size-6 cursor-pointer place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-200 hover:text-ink-700"
                            :aria-label="`Hapus tag ${tag}`"
                        >
                            <X class="size-3.5" aria-hidden="true" />
                        </TagsInputItemDelete>
                    </TagsInputItem>
                    <TagsInputInput
                        id="details-tags"
                        placeholder="Tambah tag…"
                        class="h-8 min-w-32 flex-1 bg-transparent px-1 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
                        :aria-invalid="errors.tags ? 'true' : 'false'"
                        :aria-describedby="errors.tags ? 'details-tags-error' : 'details-tags-hint'"
                    />
                </TagsInputRoot>
            </FormField>

            <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p v-if="editedNote" class="text-sm text-ink-500">{{ editedNote }}</p>
                <AppButton type="submit" class="sm:ml-auto" :is-loading="isSaving" :is-disabled="!isChanged">
                    {{ isSaving ? 'Menyimpan…' : 'Simpan' }}
                </AppButton>
            </div>
        </div>
    </form>
</template>
