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
      <FormPasswordField
        id="password_confirmation"
        v-model="passwordConfirmation"
        label="Xác nhận mật khẩu"
        autocomplete="new-password"
        :error="fieldErrors.password_confirmation"
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
const passwordConfirmation = ref('')
const remember = ref(false)
const loading = ref(false)
const { fieldErrors, formError, reset, set, focusFirst, apply } = useFormErrors(['name', 'email', 'password', 'password_confirmation'] as const)

function validate() {
  set(
    'name',
    !name.value ? 'Vui lòng nhập tên.' : !SAFE_TEXT_PATTERN.test(name.value) ? 'Tên không được chứa ký tự < hoặc >.' : undefined,
  )
  set('email', !email.value ? 'Vui lòng nhập email.' : !EMAIL_PATTERN.test(email.value) ? 'Email không hợp lệ.' : undefined)
  set('password', password.value.length < PASSWORD_MIN ? `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.` : undefined)
  set(
    'password_confirmation',
    !passwordConfirmation.value
      ? 'Vui lòng xác nhận mật khẩu.'
      : passwordConfirmation.value !== password.value
        ? 'Mật khẩu xác nhận không khớp.'
        : undefined,
  )
  return !focusFirst()
}

async function submit() {
  reset()
  if (!validate()) return

  loading.value = true
  try {
    // BE tự sinh handle ngẫu nhiên, tự đăng nhập và gửi email xác thực.
    await auth.register(name.value, email.value, password.value, passwordConfirmation.value, remember.value)
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (error) {
    apply(error)
  } finally {
    loading.value = false
  }
}
</script>
