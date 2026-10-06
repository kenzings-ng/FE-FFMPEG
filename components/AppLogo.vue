<template>
  <NuxtLink to="/" aria-label="FFmpeg Stream – Trang chủ" class="flex items-center gap-2 rounded-lg font-semibold tracking-tight text-fg">
    <span class="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
      <PlayIcon class="h-4 w-4" aria-hidden="true" />
    </span>
    <span translate="no">FFmpeg Stream</span>
  </NuxtLink>
</template>

<script setup lang="ts">
import { PlayIcon } from '@heroicons/vue/24/solid'
</script>
