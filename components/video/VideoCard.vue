<template>
  <article class="group card relative overflow-hidden transition-colors focus-within:ring-2 focus-within:ring-accent hover:border-accent/60">
    <div class="relative aspect-video overflow-hidden bg-surface-2">
      <div
        aria-hidden="true"
        class="absolute inset-0 opacity-80"
        :style="{ background: `linear-gradient(135deg, hsl(${hue} 70% 22%), hsl(${(hue + 40) % 360} 60% 10%))` }"
      />
      <template v-if="video.poster_url && !posterFailed">
        <!-- Nền mờ phủ kín khung 16:9, ảnh thật đặt giữa: video dọc không bị cắt mất nội dung. -->
        <img
          :src="video.poster_url"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          class="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl"
        />
        <img
          :src="video.poster_url"
          alt=""
          loading="lazy"
          decoding="async"
          class="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          @error="posterFailed = true"
        />
      </template>
      <div class="absolute inset-0 grid place-items-center">
        <span
          class="grid h-14 w-14 place-items-center rounded-full bg-black/40 text-white backdrop-blur transition-transform duration-200 group-hover:scale-110"
          aria-hidden="true"
        >
          <ArrowPathIcon v-if="video.status === 'PROCESSING'" class="h-6 w-6 animate-spin" />
          <ClockIcon v-else-if="video.status === 'PENDING'" class="h-6 w-6" />
          <ExclamationTriangleIcon v-else-if="video.status === 'FAILED'" class="h-6 w-6 text-danger" />
          <PlayIcon v-else class="ml-0.5 h-6 w-6" />
        </span>
      </div>
      <div class="absolute left-3 top-3 flex gap-1.5">
        <VideoStatusBadge v-if="video.status !== 'READY'" :kind="video.status" />
        <VideoStatusBadge :kind="video.is_public ? 'public' : 'private'" />
      </div>
    </div>

    <div class="p-4">
      <h2 class="line-clamp-2 font-semibold leading-snug">
        <NuxtLink :to="`/videos/${video.id}`" class="after:absolute after:inset-0 focus-visible:ring-0">
          {{ video.title }}
        </NuxtLink>
      </h2>
      <p class="mt-1 truncate text-sm text-muted">
        <template v-if="!hideChannel">
          <!-- relative z-10: nổi trên lớp link phủ cả thẻ (after:inset-0) để bấm được riêng. -->
          <NuxtLink :to="channelPath(video.user.username)" class="relative z-10 hover:text-fg hover:underline">{{
            isMine ? 'Video của bạn' : video.user.name
          }}</NuxtLink>
          ·
        </template>
        <time :datetime="parseServerDate(video.created_at).toISOString()">{{ formatRelative(video.created_at) }}</time>
      </p>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ArrowPathIcon, ClockIcon, ExclamationTriangleIcon, PlayIcon } from '@heroicons/vue/24/solid'
import { channelPath } from '~/utils/api'
import type { Video } from '~/utils/api'

const props = defineProps<{
  video: Video
  currentUserId?: string
  /** Trên trang kênh: không lặp lại tên kênh trên từng thẻ. */
  hideChannel?: boolean
}>()

const isMine = computed(() => props.video.user.id === props.currentUserId)
// Video chưa có ảnh bìa (đang xử lý / lỗi): gradient cố định theo id để các thẻ phân biệt được.
const posterFailed = ref(false)
const hue = computed(() => (Number(props.video.id) * 47) % 360)
</script>
