<template>
  <div
    :role="tone === 'danger' ? 'alert' : 'status'"
    :class="['flex gap-2 rounded-lg border px-3 py-2 text-sm', tones[tone]]"
  >
    <component :is="icons[tone]" class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <div class="min-w-0"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/vue/20/solid'

withDefaults(defineProps<{ tone?: 'danger' | 'success' | 'info' }>(), { tone: 'danger' })

const tones = {
  danger: 'border-danger/40 bg-danger/10 text-danger',
  success: 'border-success/40 bg-success/10 text-success',
  info: 'border-line bg-surface-2 text-fg',
}
const icons = { danger: ExclamationTriangleIcon, success: CheckCircleIcon, info: InformationCircleIcon }
</script>
