<template>
  <div class="card p-6 shadow-2xl sm:p-8">
    <h1 class="text-xl font-semibold tracking-tight">Tạo tài khoản</h1>
    <p class="mt-1 text-sm text-muted">Tải video lên và phát HLS nhiều chất lượng.</p>

    <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
      <FormTextField
        id="name"
        v-model.trim="name"
        label="Tên hiển thị"
        autocomplete="name"
        :maxlength="NAME_MAX"
        :error="fieldErrors.name"
      />
      <FormTextField
        id="email"
        v-model.trim="email"
        label="Email"
        type="email"
        autocomplete="email"
        inputmode="email"
        :error="fieldErrors.email"
      />
      <FormPasswordField
        id="password"
        v-model="password"
        label="Mật khẩu"
        autocomplete="new-password"
        :hint="`Tối thiểu ${PASSWORD_MIN} ký tự.`"
        :error="fieldErrors.password"
      />

      <label class="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input v-model="remember" type="checkbox" class="h-4 w-4 rounded border-line accent-[rgb(var(--accent))]" />
        Ghi nhớ đăng nhập trong 30 ngày
      </label>

      <FormAlert v-if="formError">{{ formError }}</FormAlert>

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
        {{ loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-muted">
      Đã có tài khoản?
      <NuxtLink :to="{ path: '/login', query: route.query }" class="font-medium text-accent hover:underline">Đăng nhập</NuxtLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Đăng ký · FFmpeg Stream' })

const auth = useAuth()
const route = useRoute()

const name = ref('')
const email = ref('')
const password = ref('')
const remember = ref(false)
const loading = ref(false)
const { fieldErrors, formError, reset, set, focusFirst, apply } = useFormErrors(['name', 'email', 'password'] as const)

function validate() {
  set(
    'name',
    !name.value ? 'Vui lòng nhập tên.' : !SAFE_TEXT_PATTERN.test(name.value) ? 'Tên không được chứa ký tự < hoặc >.' : undefined,
  )
  set('email', !email.value ? 'Vui lòng nhập email.' : !EMAIL_PATTERN.test(email.value) ? 'Email không hợp lệ.' : undefined)
  set('password', password.value.length < PASSWORD_MIN ? `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.` : undefined)
  return !focusFirst()
}

async function submit() {
  reset()
  if (!validate()) return

  loading.value = true
  try {
    // BE tự đăng nhập sau khi tạo và gửi email xác thực (không bắt buộc xác thực mới dùng được).
    await auth.register(name.value, email.value, password.value, remember.value)
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (error) {
    apply(error)
  } finally {
    loading.value = false
  }
}
</script>
