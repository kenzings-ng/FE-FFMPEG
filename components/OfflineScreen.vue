<template>
  <!--
    Phủ lên trên thay vì thay thế trang: trang bên dưới (vd. form upload đang
    gửi, video đang phát) vẫn được giữ nguyên để có mạng lại là dùng tiếp.
  -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150"
    leave-to-class="opacity-0"
  >
    <div
      v-if="!online"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      aria-describedby="offline-desc"
      class="fixed inset-0 z-[60] flex items-center justify-center overscroll-contain bg-bg/95 px-4 backdrop-blur"
    >
      <div class="w-full max-w-md text-center">
        <span class="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-surface-2" aria-hidden="true">
          <WifiIcon class="h-10 w-10 text-muted" />
          <span class="absolute h-0.5 w-14 rotate-45 rounded-full bg-danger" />
        </span>
        <h1 id="offline-title" class="mt-6 text-2xl font-semibold tracking-tight">Mất kết nối internet</h1>
        <p id="offline-desc" class="mt-3 text-muted">
          Kiểm tra Wi‑Fi hoặc dữ liệu di động. Trang hiện tại vẫn được giữ nguyên và sẽ tiếp tục khi có mạng trở lại.
        </p>
        <ul class="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm text-muted">
          <li class="flex gap-2"><CheckIcon class="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />Tắt chế độ máy bay</li>
          <li class="flex gap-2"><CheckIcon class="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />Khởi động lại router hoặc kết nối mạng khác</li>
          <li class="flex gap-2"><CheckIcon class="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />Tắt VPN / proxy nếu đang bật</li>
        </ul>
        <button ref="retryButton" type="button" class="btn-primary mt-8" :disabled="checking" @click="retry">
          <ArrowPathIcon :class="['h-4 w-4', checking && 'animate-spin']" aria-hidden="true" />
          {{ checking ? 'Đang kiểm tra…' : 'Thử kết nối lại' }}
        </button>
        <p v-if="stillOffline" role="status" class="mt-3 text-sm text-danger">Vẫn chưa kết nối được. Thử lại sau giây lát.</p>
      </div>
    </div>
  </Transition>

  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="opacity-0 translate-y-2"
    leave-active-class="transition duration-150"
    leave-to-class="opacity-0"
  >
    <div
      v-if="online && justReconnected"
      role="status"
      class="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full border border-success/40 bg-surface px-4 py-2 text-sm shadow-xl"
    >
      <WifiIcon class="h-4 w-4 text-success" aria-hidden="true" />
      Đã kết nối lại
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ArrowPathIcon, CheckIcon, WifiIcon } from '@heroicons/vue/24/outline'

const config = useRuntimeConfig()
const { online, justReconnected, check } = useNetworkStatus()

const checking = ref(false)
const stillOffline = ref(false)
const retryButton = ref<HTMLButtonElement | null>(null)

// Đưa focus vào nút "Thử lại" để người dùng bàn phím / screen reader biết ngay.
watch(online, (value) => {
  stillOffline.value = false
  if (!value) nextTick(() => retryButton.value?.focus())
})

async function retry() {
  checking.value = true
  stillOffline.value = !(await check(config.public.apiBase))
  checking.value = false
}
</script>
