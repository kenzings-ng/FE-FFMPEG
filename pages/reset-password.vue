<template>
  <div class="card p-6 shadow-2xl sm:p-8">
    <h1 class="text-xl font-semibold tracking-tight">Đặt lại mật khẩu</h1>

    <template v-if="!token || !email">
      <FormAlert class="mt-6">Link đặt lại mật khẩu không đầy đủ. Hãy mở lại link trong email, hoặc yêu cầu link mới.</FormAlert>
      <NuxtLink to="/forgot-password" class="btn-primary mt-6 w-full">Yêu cầu link mới</NuxtLink>
    </template>

    <template v-else>
      <p class="mt-1 text-sm text-muted">
        Tạo mật khẩu mới cho <strong class="break-all text-fg">{{ email }}</strong>.
      </p>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
        <!-- Cho trình quản lý mật khẩu biết mật khẩu mới thuộc tài khoản nào. -->
        <input type="email" name="email" autocomplete="username" :value="email" class="sr-only" tabindex="-1" aria-hidden="true" readonly />
        <FormPasswordField
          id="password"
          v-model="password"
          label="Mật khẩu mới"
          autocomplete="new-password"
          :hint="`Tối thiểu ${PASSWORD_MIN} ký tự.`"
          :error="fieldErrors.password"
        />
        <FormPasswordField
          id="confirm"
          v-model="confirm"
          label="Nhập lại mật khẩu mới"
          autocomplete="new-password"
          :error="fieldErrors.confirm"
        />

        <FormAlert v-if="formError">
          {{ formError }}
          <NuxtLink v-if="tokenInvalid" :to="{ path: '/forgot-password', query: { email } }" class="font-semibold underline">
            Yêu cầu link mới
          </NuxtLink>
        </FormAlert>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
          {{ loading ? 'Đang lưu…' : 'Đặt mật khẩu mới' }}
        </button>
      </form>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { GraphqlError, postGraphql } from '~/utils/graphql'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Đặt lại mật khẩu · FFmpeg Stream', meta: [{ name: 'referrer', content: 'no-referrer' }] })

const config = useRuntimeConfig()
const route = useRoute()

// Link trong email: {FRONTEND_URL}/reset-password?token=...&email=...
const token = typeof route.query.token === 'string' ? route.query.token : ''
const email = typeof route.query.email === 'string' ? route.query.email : ''

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const tokenInvalid = ref(false)
const { fieldErrors, formError, reset, set, focusFirst, apply } = useFormErrors(['password', 'confirm'] as const)

async function submit() {
  reset()
  tokenInvalid.value = false
  set('password', password.value.length < PASSWORD_MIN ? `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.` : undefined)
  set('confirm', confirm.value !== password.value ? 'Mật khẩu nhập lại không khớp.' : undefined)
  if (focusFirst()) return

  loading.value = true
  try {
    await postGraphql(`${config.public.apiBase}/graphql`, RESET_PASSWORD_MUTATION, { email, token, password: password.value })
    await navigateTo({ path: '/login', query: { email, reset: '1' } })
  } catch (error) {
    tokenInvalid.value = error instanceof GraphqlError && !!(error.field('token') || error.field('email'))
    apply(error)
  } finally {
    loading.value = false
  }
}
</script>
