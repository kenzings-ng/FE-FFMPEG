<template>
  <div class="card p-6 text-center shadow-2xl sm:p-8">
    <component
      :is="ok ? CheckBadgeIcon : ExclamationTriangleIcon"
      :class="['mx-auto h-12 w-12', ok ? 'text-success' : 'text-warning']"
      aria-hidden="true"
    />
    <h1 class="mt-4 text-xl font-semibold tracking-tight">
      {{ ok ? 'Đã xác thực email' : 'Link xác thực không hợp lệ' }}
    </h1>
    <p class="mt-2 text-sm text-muted">
      {{
        ok
          ? 'Cảm ơn bạn! Tài khoản đã được xác thực.'
          : 'Link đã hết hạn (60 phút) hoặc không đúng. Đăng nhập rồi gửi lại email xác thực từ trang Tài khoản.'
      }}
    </p>

    <div class="mt-6 flex flex-col gap-3">
      <template v-if="isLoggedIn">
        <NuxtLink v-if="ok" to="/" class="btn-primary w-full">Vào thư viện</NuxtLink>
        <NuxtLink v-else to="/profile" class="btn-primary w-full">Gửi lại email xác thực</NuxtLink>
      </template>
      <NuxtLink v-else to="/login" class="btn-primary w-full">Đăng nhập</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CheckBadgeIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

definePageMeta({ layout: 'auth' })

// BE (VerifyEmailController) redirect về: /email-verified?status=ok|invalid
const route = useRoute()
const ok = computed(() => route.query.status === 'ok')
const { isLoggedIn } = useAuth()
const { loadUser } = useAccount()

useHead({ title: () => (ok.value ? 'Đã xác thực email' : 'Xác thực thất bại') + ' · FFmpeg Stream' })

// Đang đăng nhập ở tab này: tải lại `me` để banner "chưa xác thực" biến mất.
onMounted(() => {
  if (ok.value && isLoggedIn.value) loadUser(true).catch(() => {})
})
</script>
