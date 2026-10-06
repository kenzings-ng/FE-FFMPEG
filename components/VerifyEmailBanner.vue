<template>
  <div v-if="visible" class="border-b border-warning/30 bg-warning/10">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:px-6 lg:px-8">
      <ExclamationCircleIcon class="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
      <p class="min-w-0 flex-1">
        Email <strong class="break-all">{{ user!.email }}</strong> chưa được xác thực.
      </p>
      <NuxtLink to="/profile" class="rounded font-semibold text-warning hover:underline">Gửi lại email</NuxtLink>
      <button
        type="button"
        class="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-warning/10 hover:text-fg"
        aria-label="Ẩn thông báo"
        @click="dismiss"
      >
        <XMarkIcon class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExclamationCircleIcon, XMarkIcon } from '@heroicons/vue/20/solid'

// BE không bắt buộc xác thực mới dùng được, nên chỉ nhắc nhẹ; ẩn trong phiên tab hiện tại.
const DISMISS_KEY = 'ffmpeg-stream.verify-banner-dismissed'

const { user } = useAccount()
const route = useRoute()
const dismissed = ref(false)

onMounted(() => {
  try {
    dismissed.value = sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {}
})

const visible = computed(() => !!user.value && !user.value.email_verified_at && !dismissed.value && route.path !== '/profile')

function dismiss() {
  dismissed.value = true
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {}
}
</script>
