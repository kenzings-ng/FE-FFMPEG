<template>
  <div class="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgb(var(--accent)/0.15),transparent_60%)]"
    />
    <main class="relative w-full max-w-lg text-center">
      <AppLogo class="inline-flex" />

      <p class="mt-10 text-7xl font-bold tabular-nums tracking-tight text-accent sm:text-8xl" aria-hidden="true">
        {{ statusCode }}
      </p>
      <h1 class="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{{ content.title }}</h1>
      <p class="mx-auto mt-3 max-w-md text-muted">{{ content.description }}</p>

      <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" class="btn-primary" @click="goHome">
          <HomeIcon class="h-4 w-4" aria-hidden="true" />
          Về thư viện
        </button>
        <button v-if="content.retry" type="button" class="btn-ghost" @click="retry">
          <ArrowPathIcon class="h-4 w-4" aria-hidden="true" />
          Thử lại
        </button>
        <button v-else type="button" class="btn-ghost" @click="goBack">
          <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
          Quay lại
        </button>
      </div>

      <details v-if="isDev && error.message" class="mt-10 text-left">
        <summary class="cursor-pointer text-sm text-muted">Chi tiết lỗi (chỉ hiện ở môi trường dev)</summary>
        <pre class="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs">{{ error.message }}</pre>
      </details>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'
import { ArrowLeftIcon, ArrowPathIcon, HomeIcon } from '@heroicons/vue/24/outline'

/**
 * Trang lỗi toàn cục của Nuxt: route không tồn tại (404), lỗi JS chưa bắt,
 * hoặc throw createError({ statusCode }) ở bất kỳ đâu.
 */
const props = defineProps<{ error: NuxtError }>()

const isDev = import.meta.dev
const statusCode = computed(() => props.error.statusCode || 500)

const content = computed(() => {
  switch (statusCode.value) {
    case 404:
      return {
        title: 'Không tìm thấy trang',
        description: 'Đường dẫn không tồn tại hoặc đã bị đổi. Kiểm tra lại địa chỉ, hoặc quay về thư viện video.',
        retry: false,
      }
    case 403:
      return {
        title: 'Bạn không có quyền truy cập',
        description: 'Nội dung này riêng tư hoặc thuộc về người khác.',
        retry: false,
      }
    case 429:
      return {
        title: 'Thao tác quá nhanh',
        description: 'Bạn đã gửi quá nhiều yêu cầu. Đợi khoảng một phút rồi thử lại.',
        retry: true,
      }
    case 502:
    case 503:
    case 504:
      return {
        title: 'Máy chủ đang tạm ngưng',
        description: 'Máy chủ đang bảo trì hoặc quá tải. Vui lòng thử lại sau ít phút.',
        retry: true,
      }
    default:
      return {
        title: 'Đã có lỗi xảy ra',
        description: 'Ứng dụng gặp sự cố không mong muốn. Thử tải lại trang; nếu vẫn lỗi, hãy quay lại sau.',
        retry: true,
      }
  }
})

useHead({ title: () => `${statusCode.value} · ${content.value.title} · FFmpeg Stream` })

const goHome = () => clearError({ redirect: '/' })
const retry = () => reloadNuxtApp({ persistState: false })
function goBack() {
  if (window.history.length > 1) {
    clearError()
    window.history.back()
  } else {
    goHome()
  }
}
</script>
