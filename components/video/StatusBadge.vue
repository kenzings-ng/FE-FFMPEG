<template>
  <span :class="['inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', current.tone]">
    <component :is="current.icon" :class="['h-3.5 w-3.5', kind === 'PROCESSING' && 'animate-spin']" aria-hidden="true" />
    {{ current.label }}
  </span>
</template>

<script setup lang="ts">
import { ArrowPathIcon, ClockIcon, ExclamationTriangleIcon, GlobeAltIcon, LockClosedIcon } from '@heroicons/vue/20/solid'
import type { VideoStatus } from '~/utils/api'

/** Quyền xem (public/private) hoặc trạng thái xử lý (trừ READY: không cần badge). */
const props = defineProps<{ kind: 'public' | 'private' | Exclude<VideoStatus, 'READY'> }>()

const config = {
  public: { label: 'Công khai', icon: GlobeAltIcon, tone: 'bg-success/15 text-success' },
  private: { label: 'Riêng tư', icon: LockClosedIcon, tone: 'bg-surface-2 text-muted' },
  PENDING: { label: 'Đang chờ', icon: ClockIcon, tone: 'bg-surface-2 text-fg' },
  PROCESSING: { label: 'Đang xử lý', icon: ArrowPathIcon, tone: 'bg-warning/15 text-warning' },
  FAILED: { label: 'Lỗi xử lý', icon: ExclamationTriangleIcon, tone: 'bg-danger/15 text-danger' },
} as const

const current = computed(() => config[props.kind])
</script>
