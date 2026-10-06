<template>
  <div class="card p-6 shadow-2xl sm:p-8">
    <h1 class="text-xl font-semibold tracking-tight">Quên mật khẩu</h1>

    <template v-if="sent">
      <FormAlert tone="success" class="mt-6">
        Nếu <strong class="break-all">{{ email }}</strong> đã đăng ký, bạn sẽ nhận được email chứa link đặt lại mật khẩu
        trong vài phút. Nhớ kiểm tra cả thư mục spam.
      </FormAlert>
      <div class="mt-6 flex flex-col gap-3">
        <NuxtLink :to="{ path: '/login', query: { email } }" class="btn-primary w-full">Về trang đăng nhập</NuxtLink>
        <button type="button" class="btn-ghost w-full" @click="sent = false">Gửi lại tới email khác</button>
      </div>
    </template>

    <template v-else>
      <p class="mt-1 text-sm text-muted">Nhập email đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu.</p>
      <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
        <FormTextField
          id="email"
          v-model.trim="email"
          label="Email"
          type="email"
          autocomplete="email"
          inputmode="email"
          :error="fieldErrors.email"
        />
        <FormAlert v-if="formError">{{ formError }}</FormAlert>
        <button type="submit" class="btn-primary w-full" :disabled="loading">
          <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
          {{ loading ? 'Đang gửi…' : 'Gửi link đặt lại' }}
        </button>
      </form>
      <p class="mt-6 text-center text-sm text-muted">
        Nhớ ra rồi?
        <NuxtLink to="/login" class="font-medium text-accent hover:underline">Đăng nhập</NuxtLink>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { postGraphql } from '~/utils/graphql'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Quên mật khẩu · FFmpeg Stream' })

const config = useRuntimeConfig()
const route = useRoute()

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const loading = ref(false)
const sent = ref(false)
const { fieldErrors, formError, reset, set, focusFirst, apply } = useFormErrors(['email'] as const)

async function submit() {
  reset()
  set('email', !email.value ? 'Vui lòng nhập email.' : !EMAIL_PATTERN.test(email.value) ? 'Email không hợp lệ.' : undefined)
  if (focusFirst()) return

  loading.value = true
  try {
    // BE luôn trả true dù email có tồn tại hay không (chống dò email), nên FE
    // cũng chỉ báo chung chung.
    await postGraphql(`${config.public.apiBase}/graphql`, FORGOT_PASSWORD_MUTATION, { email: email.value })
    sent.value = true
  } catch (error) {
    apply(error)
  } finally {
    loading.value = false
  }
}
</script>
