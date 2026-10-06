<template>
  <div :role="tone === 'danger' ? 'alert' : undefined" class="card mt-8 flex flex-col items-center gap-4 px-6 py-10 text-center">
    <component :is="icon ?? ExclamationTriangleIcon" :class="['h-10 w-10', tone === 'danger' ? 'text-danger' : 'text-muted']" aria-hidden="true" />
    <div>
      <p class="font-semibold">{{ title }}</p>
      <p v-if="description" class="mt-1 max-w-md text-sm text-muted">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

/** Khối trạng thái rỗng / lỗi dùng chung cho danh sách và trang chi tiết. */
defineProps<{ title: string; description?: string; icon?: Component; tone?: 'danger' | 'neutral' }>()
</script>
