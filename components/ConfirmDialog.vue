<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="relative z-50" :initial-focus="cancelButton" @close="!loading && emit('cancel')">
      <TransitionChild
        as="template"
        enter="duration-150 ease-out"
        enter-from="opacity-0"
        leave="duration-100 ease-in"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/60" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-y-auto overscroll-contain">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-150 ease-out"
            enter-from="opacity-0 scale-95"
            leave="duration-100 ease-in"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="card w-full max-w-md p-6 shadow-2xl">
              <div class="flex gap-4">
                <span
                  :class="[
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                    tone === 'danger' ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-fg',
                  ]"
                  aria-hidden="true"
                >
                  <ExclamationTriangleIcon class="h-5 w-5" />
                </span>
                <div class="min-w-0">
                  <DialogTitle class="font-semibold">{{ title }}</DialogTitle>
                  <DialogDescription class="mt-1 text-sm text-muted"><slot /></DialogDescription>
                </div>
              </div>
              <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button ref="cancelButton" type="button" class="btn-ghost" :disabled="loading" @click="emit('cancel')">Hủy</button>
                <button
                  type="button"
                  :class="tone === 'danger' ? 'btn bg-danger text-white hover:bg-danger/90' : 'btn-primary'"
                  :disabled="loading"
                  @click="emit('confirm')"
                >
                  <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
                  {{ confirmLabel }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import { Dialog, DialogDescription, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

withDefaults(
  defineProps<{ open: boolean; title: string; confirmLabel: string; tone?: 'danger' | 'neutral'; loading?: boolean }>(),
  { tone: 'neutral' },
)
const emit = defineEmits<{ confirm: []; cancel: [] }>()

// Mặc định focus nút Hủy: tránh lỡ tay Enter xác nhận thao tác phá hủy.
const cancelButton = ref<HTMLElement | null>(null)
</script>
