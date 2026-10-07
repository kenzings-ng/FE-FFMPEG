<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Tài khoản</h1>
    <p v-if="user" class="mt-1 text-sm text-muted">Thành viên từ {{ formatDate(user.created_at) }}</p>

    <div v-if="user" class="mt-8 space-y-6">
      <!-- Email -->
      <section aria-labelledby="email-heading" class="card p-6">
        <h2 id="email-heading" class="font-semibold">Email</h2>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="break-all">{{ user.email }}</span>
          <span
            :class="[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              user.email_verified_at ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
            ]"
          >
            <component :is="user.email_verified_at ? CheckBadgeIcon : ExclamationCircleIcon" class="h-3.5 w-3.5" aria-hidden="true" />
            {{ user.email_verified_at ? 'Đã xác thực' : 'Chưa xác thực' }}
          </span>
        </div>
        <template v-if="!user.email_verified_at">
          <p class="mt-3 text-sm text-muted">Mở link trong email xác thực (hết hạn sau 60 phút). Không thấy email? Gửi lại bên dưới.</p>
          <button type="button" class="btn-ghost mt-4" :disabled="resend.loading || resend.cooldown > 0" @click="resendEmail">
            <ArrowPathIcon v-if="resend.loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
            {{ resend.cooldown > 0 ? `Gửi lại sau ${resend.cooldown}s` : 'Gửi lại email xác thực' }}
          </button>
          <FormAlert v-if="resend.message" :tone="resend.error ? 'danger' : 'success'" class="mt-3">{{ resend.message }}</FormAlert>
        </template>
      </section>

      <!-- Tên -->
      <section aria-labelledby="name-heading" class="card p-6">
        <h2 id="name-heading" class="font-semibold">Thông tin cá nhân</h2>
        <form class="mt-4 space-y-4" novalidate @submit.prevent="saveName">
          <FormTextField
            id="name"
            v-model.trim="name"
            label="Tên hiển thị"
            autocomplete="name"
            :maxlength="NAME_MAX"
            :error="nameForm.fieldErrors.name"
          />
          <FormTextField
            id="username"
            v-model.trim="username"
            label="Tên người dùng"
            autocomplete="username"
            autocapitalize="none"
            :spellcheck="false"
            :maxlength="USERNAME_MAX + 1"
            :hint="usernameHint"
            :error="nameForm.fieldErrors.username ?? (usernameStatus.state === 'error' ? usernameStatus.message : undefined)"
          >
            <template #label-extra><span class="text-xs text-muted">Đổi tối đa 2 lần / 14 ngày</span></template>
          </FormTextField>
          <div>
            <div class="flex items-baseline justify-between gap-2">
              <label for="bio" class="label">Giới thiệu</label>
              <span :class="['text-xs', bio.length > BIO_MAX ? 'text-danger' : 'text-muted']">{{ bio.length }}/{{ BIO_MAX }}</span>
            </div>
            <textarea
              id="bio"
              v-model="bio"
              rows="4"
              class="input min-h-24 w-full resize-y"
              placeholder="Giới thiệu ngắn về bạn, hiện trên trang kênh"
              :aria-invalid="!!nameForm.fieldErrors.bio"
              :aria-describedby="nameForm.fieldErrors.bio ? 'bio-error' : undefined"
            />
            <p v-if="nameForm.fieldErrors.bio" id="bio-error" class="mt-1.5 text-sm text-danger">{{ nameForm.fieldErrors.bio }}</p>
          </div>
          <FormAlert v-if="nameForm.formError.value">{{ nameForm.formError.value }}</FormAlert>
          <FormAlert v-if="nameSaved" tone="success">Đã lưu thông tin.</FormAlert>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <NuxtLink :to="channelPath(user.username)" class="text-sm font-medium text-accent hover:underline">Xem kênh của bạn</NuxtLink>
            <button type="submit" class="btn-primary" :disabled="savingName || !profileChanged">
              <ArrowPathIcon v-if="savingName" class="h-4 w-4 animate-spin" aria-hidden="true" />
              {{ savingName ? 'Đang lưu…' : 'Lưu thông tin' }}
            </button>
          </div>
        </form>
      </section>

      <!-- Mật khẩu -->
      <section aria-labelledby="password-heading" class="card p-6">
        <h2 id="password-heading" class="font-semibold">Đổi mật khẩu</h2>
        <form class="mt-4 space-y-4" novalidate @submit.prevent="savePassword">
          <input type="email" name="email" autocomplete="username" :value="user.email" class="sr-only" tabindex="-1" aria-hidden="true" readonly />
          <FormPasswordField
            id="current_password"
            v-model="currentPassword"
            label="Mật khẩu hiện tại"
            autocomplete="current-password"
            :error="passwordForm.fieldErrors.current_password"
          />
          <FormPasswordField
            id="password"
            v-model="password"
            label="Mật khẩu mới"
            autocomplete="new-password"
            :hint="`Tối thiểu ${PASSWORD_MIN} ký tự.`"
            :error="passwordForm.fieldErrors.password"
          />
          <FormPasswordField
            id="confirm"
            v-model="confirm"
            label="Nhập lại mật khẩu mới"
            autocomplete="new-password"
            :error="passwordForm.fieldErrors.confirm"
          />
          <FormAlert v-if="passwordForm.formError.value">{{ passwordForm.formError.value }}</FormAlert>
          <FormAlert v-if="passwordSaved" tone="success">Đã đổi mật khẩu.</FormAlert>
          <div class="flex justify-end">
            <button type="submit" class="btn-primary" :disabled="savingPassword">
              <ArrowPathIcon v-if="savingPassword" class="h-4 w-4 animate-spin" aria-hidden="true" />
              {{ savingPassword ? 'Đang lưu…' : 'Đổi mật khẩu' }}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="session-heading" class="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 id="session-heading" class="font-semibold">Phiên đăng nhập</h2>
          <p class="mt-1 text-sm text-muted">Đăng xuất và thu hồi token của thiết bị này.</p>
        </div>
        <button type="button" class="btn-ghost text-danger" @click="logout">
          <ArrowRightStartOnRectangleIcon class="h-4 w-4" aria-hidden="true" />
          Đăng xuất
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon, ArrowRightStartOnRectangleIcon, CheckBadgeIcon, ExclamationCircleIcon } from '@heroicons/vue/24/outline'
import { channelPath } from '~/utils/api'
import { USERNAME_MAX, normalizeUsername, usernameFormatError } from '~/utils/username'

useHead({ title: 'Tài khoản · FFmpeg Stream' })

const { user, loadUser, updateProfile, resendVerificationEmail, logout } = useAccount()

// Luôn lấy `me` mới khi mở trang (vd. vừa xác thực email ở tab khác).
onMounted(() => loadUser(true).catch(() => {}))

// ---- Tên hiển thị + tên người dùng ----
const name = ref(user.value?.name ?? '')
const username = ref(user.value?.username ?? '')
const BIO_MAX = 1000
const bio = ref(user.value?.bio ?? '')
// Dữ liệu `me` mới về (lúc mở trang / sau khi lưu): chỉ cập nhật ô người dùng
// chưa sửa, không ghi đè thứ họ đang gõ.
watch(
  () => user.value,
  (value, old) => {
    if (!value) return
    if (!old || name.value === old.name) name.value = value.name
    if (!old || normalizeUsername(username.value) === old.username) username.value = value.username
    if (!old || bio.value === (old.bio ?? '')) bio.value = value.bio ?? ''
  },
)
const currentUsername = computed(() => user.value?.username)
const usernameStatus = useUsernameCheck(username, currentUsername)
const usernameHint = computed(() =>
  usernameStatus.value.state === 'ok'
    ? usernameStatus.value.message
    : usernameStatus.value.state === 'checking'
      ? 'Đang kiểm tra…'
      : `Người khác nhắc bạn bằng @${normalizeUsername(username.value) || '…'}`,
)
const usernameChanged = computed(() => normalizeUsername(username.value) !== user.value?.username)
const bioChanged = computed(() => bio.value.trim() !== (user.value?.bio ?? ''))
const profileChanged = computed(() => name.value !== user.value?.name || usernameChanged.value || bioChanged.value)
const savingName = ref(false)
const nameSaved = ref(false)
const nameForm = useFormErrors(['name', 'username', 'bio'] as const)

async function saveName() {
  nameForm.reset()
  nameSaved.value = false
  nameForm.set(
    'name',
    !name.value ? 'Vui lòng nhập tên.' : !SAFE_TEXT_PATTERN.test(name.value) ? 'Tên không được chứa ký tự < hoặc >.' : undefined,
  )
  nameForm.set('username', usernameFormatError(username.value))
  nameForm.set('bio', bio.value.length > BIO_MAX ? `Giới thiệu tối đa ${BIO_MAX} ký tự.` : undefined)
  if (nameForm.focusFirst()) return

  savingName.value = true
  try {
    await updateProfile({
      name: name.value,
      ...(usernameChanged.value ? { username: normalizeUsername(username.value) } : {}),
      // Chuỗi rỗng = xóa phần giới thiệu.
      ...(bioChanged.value ? { bio: bio.value.trim() } : {}),
    })
    nameSaved.value = true
  } catch (error) {
    nameForm.apply(error)
  } finally {
    savingName.value = false
  }
}

// ---- Mật khẩu ----
const currentPassword = ref('')
const password = ref('')
const confirm = ref('')
const savingPassword = ref(false)
const passwordSaved = ref(false)
const passwordForm = useFormErrors(['current_password', 'password', 'confirm'] as const)

async function savePassword() {
  passwordForm.reset()
  passwordSaved.value = false
  passwordForm.set('current_password', !currentPassword.value ? 'Vui lòng nhập mật khẩu hiện tại.' : undefined)
  passwordForm.set('password', password.value.length < PASSWORD_MIN ? `Mật khẩu cần tối thiểu ${PASSWORD_MIN} ký tự.` : undefined)
  passwordForm.set('confirm', confirm.value !== password.value ? 'Mật khẩu nhập lại không khớp.' : undefined)
  if (passwordForm.focusFirst()) return

  savingPassword.value = true
  try {
    // BE bắt buộc current_password khi đổi mật khẩu (chứng minh đúng chủ tài khoản).
    await updateProfile({ current_password: currentPassword.value, password: password.value })
    currentPassword.value = ''
    password.value = ''
    confirm.value = ''
    passwordSaved.value = true
  } catch (error) {
    passwordForm.apply(error)
  } finally {
    savingPassword.value = false
  }
}

// ---- Gửi lại email xác thực ----
// BE throttle chung "oauth-token" (10 lần/phút/IP): khóa nút 60s sau mỗi lần gửi.
const RESEND_COOLDOWN_S = 60
const resend = reactive({ loading: false, cooldown: 0, message: '', error: false })
let cooldownTimer: ReturnType<typeof setInterval> | null = null

async function resendEmail() {
  resend.loading = true
  resend.message = ''
  try {
    await resendVerificationEmail()
    resend.error = false
    resend.message = `Đã gửi email xác thực tới ${user.value?.email}.`
    resend.cooldown = RESEND_COOLDOWN_S
    cooldownTimer = setInterval(() => {
      if (--resend.cooldown <= 0 && cooldownTimer) clearInterval(cooldownTimer)
    }, 1000)
  } catch (error) {
    resend.error = true
    resend.message = errorMessage(error)
  } finally {
    resend.loading = false
  }
}

onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>
