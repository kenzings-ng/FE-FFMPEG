<template>
  <FormTextField
    v-model="model"
    :id="id"
    :label="label"
    :type="visible ? 'text' : 'password'"
    :autocomplete="autocomplete"
    :disabled="disabled"
    :hint="hint"
    :error="error"
  >
    <template v-if="$slots['label-extra']" #label-extra><slot name="label-extra" /></template>
    <template #trailing>
      <button
        type="button"
        class="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-muted hover:text-fg"
        :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
        :aria-pressed="visible"
        :aria-controls="id"
        @click="visible = !visible"
      >
        <EyeSlashIcon v-if="visible" class="h-5 w-5" aria-hidden="true" />
        <EyeIcon v-else class="h-5 w-5" aria-hidden="true" />
      </button>
    </template>
  </FormTextField>
</template>

<script setup lang="ts">
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

defineProps<{
  id: string
  label: string
  /** current-password (đăng nhập) hoặc new-password (đăng ký / đổi mật khẩu). */
  autocomplete: 'current-password' | 'new-password'
  disabled?: boolean
  hint?: string
  error?: string
}>()

const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>
