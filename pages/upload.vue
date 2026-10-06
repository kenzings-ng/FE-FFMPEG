<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Tải video lên</h1>
    <p class="mt-1 text-sm text-muted">
      Sau khi tải lên, máy chủ sẽ encode sang HLS 240p → 1080p và mã hóa AES-128. Việc này có thể mất vài phút.
    </p>

    <form class="card mt-8 space-y-6 p-6" novalidate @submit.prevent="submit">
      <div>
        <span id="file-label" class="label">File video</span>
        <label
          for="file"
          :class="[
            'flex cursor-pointer flex-col items-center focus-within:ring-2 focus-within:ring-accent justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            dragging ? 'border-accent bg-accent/10' : errors.file ? 'border-danger/60' : 'border-line hover:border-accent/60 hover:bg-surface-2',
            uploading && 'pointer-events-none opacity-60',
          ]"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <template v-if="file">
            <FilmIcon class="h-10 w-10 text-accent" aria-hidden="true" />
            <span class="max-w-full break-all font-medium">{{ file.name }}</span>
            <span class="text-sm text-muted">{{ formatBytes(file.size) }} · Bấm để chọn file khác</span>
          </template>
          <template v-else>
            <ArrowUpTrayIcon class="h-10 w-10 text-muted" aria-hidden="true" />
            <span class="font-medium">Kéo thả video vào đây hoặc <span class="text-accent">chọn file</span></span>
            <span class="text-sm text-muted">MP4, MOV, MKV, WebM… tối đa 2&nbsp;GB</span>
          </template>
          <input
            id="file"
            type="file"
            accept="video/*"
            class="sr-only"
            aria-labelledby="file-label"
            :aria-invalid="!!errors.file"
            :aria-describedby="errors.file ? 'file-error' : undefined"
            :disabled="uploading"
            @change="onPick"
          />
        </label>
        <p v-if="errors.file" id="file-error" class="mt-1.5 text-sm text-danger">{{ errors.file }}</p>
      </div>

      <div>
        <div class="flex items-baseline justify-between">
          <label for="title" class="label">Tiêu đề</label>
          <span class="text-xs text-muted">{{ title.length }}/{{ TITLE_MAX }}</span>
        </div>
        <input
          id="title"
          v-model="title"
          name="title"
          autocomplete="off"
          type="text"
          class="input"
          :maxlength="TITLE_MAX"
          :disabled="uploading"
          :aria-invalid="!!errors.title"
          :aria-describedby="errors.title ? 'title-error' : undefined"
        />
        <p v-if="errors.title" id="title-error" class="mt-1.5 text-sm text-danger">{{ errors.title }}</p>
      </div>

      <SwitchGroup as="div" class="flex items-start justify-between gap-4">
        <div>
          <SwitchLabel class="text-sm font-medium">Công khai</SwitchLabel>
          <SwitchDescription class="mt-0.5 text-xs text-muted">
            Tắt: chỉ bạn xem được. Bạn có thể đổi lại bất cứ lúc nào.
          </SwitchDescription>
        </div>
        <Switch
          v-model="isPublic"
          :disabled="uploading"
          :class="[
            isPublic ? 'bg-accent' : 'bg-surface-2 ring-1 ring-inset ring-line',
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-60',
          ]"
        >
          <span
            aria-hidden="true"
            :class="[
              isPublic ? 'translate-x-5' : 'translate-x-0.5',
              'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
            ]"
          />
        </Switch>
      </SwitchGroup>

      <div v-if="uploading" aria-live="polite">
        <div class="mb-1.5 flex justify-between text-sm">
          <span>{{ progress < 1 ? 'Đang tải lên…' : 'Đang chờ máy chủ xác nhận…' }}</span>
          <span class="tabular-nums text-muted">{{ Math.round(progress * 100) }}%</span>
        </div>
        <div
          class="h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Tiến độ tải lên"
          :aria-valuenow="Math.round(progress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="h-full rounded-full bg-accent transition-[width] duration-200" :style="{ width: `${progress * 100}%` }" />
        </div>
      </div>

      <p v-if="formError" role="alert" class="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        {{ formError }}
      </p>

      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button v-if="uploading" type="button" class="btn-ghost" @click="controller?.abort()">Hủy</button>
        <button type="submit" class="btn-primary" :disabled="uploading">
          <ArrowUpTrayIcon class="h-4 w-4" aria-hidden="true" />
          Tải lên
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { Switch, SwitchDescription, SwitchGroup, SwitchLabel } from '@headlessui/vue'
import { ArrowUpTrayIcon, FilmIcon } from '@heroicons/vue/24/outline'
import { GraphqlError } from '~/utils/graphql'
import type { Video } from '~/utils/api'

useHead({ title: 'Tải lên · FFmpeg Stream' })

const { upload } = useGraphql()

const file = ref<File | null>(null)
const title = ref('')
const isPublic = ref(false)
const dragging = ref(false)
const uploading = ref(false)
const progress = ref(0)
const formError = ref('')
const errors = reactive<{ file?: string; title?: string }>({})
const controller = shallowRef<AbortController | null>(null)

// Rời trang khi đang upload sẽ hủy request: hỏi lại trước.
function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (uploading.value) event.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))
onBeforeRouteLeave(() => !uploading.value || confirm('Video đang tải lên. Rời trang sẽ hủy tải lên?'))

function selectFile(picked: File | undefined) {
  if (!picked) return
  file.value = picked
  errors.file = undefined
  // Gợi ý tiêu đề từ tên file nếu người dùng chưa nhập.
  if (!title.value) title.value = picked.name.replace(/\.[^.]+$/, '').replace(/[<>]/g, '').slice(0, TITLE_MAX)
}

function onPick(event: Event) {
  selectFile((event.target as HTMLInputElement).files?.[0])
}

function onDrop(event: DragEvent) {
  dragging.value = false
  if (!uploading.value) selectFile(event.dataTransfer?.files?.[0])
}

function validate() {
  errors.file = !file.value
    ? 'Vui lòng chọn một file video.'
    : // Một số trình duyệt để trống MIME với .mkv/.ts: để BE (mimetypes:video/*) quyết.
      file.value.type && !file.value.type.startsWith('video/')
      ? 'File phải là video.'
      : file.value.size > MAX_UPLOAD_BYTES
        ? 'File vượt quá 2 GB.'
        : undefined

  const trimmed = title.value.trim()
  errors.title = !trimmed
    ? 'Vui lòng nhập tiêu đề.'
    : !TITLE_PATTERN.test(trimmed)
      ? 'Tiêu đề không được chứa ký tự < hoặc >.'
      : undefined

  return !errors.file && !errors.title
}

async function submit() {
  formError.value = ''
  if (!validate() || !file.value) {
    document.getElementById(errors.file ? 'file' : 'title')?.focus()
    return
  }

  uploading.value = true
  progress.value = 0
  controller.value = new AbortController()

  try {
    const data = await upload<{ uploadVideo: Video }>(
      UPLOAD_VIDEO_MUTATION,
      { title: title.value.trim(), is_public: isPublic.value },
      'file',
      file.value,
      { signal: controller.value.signal, onProgress: (p) => (progress.value = p) },
    )
    // Tắt cờ trước khi chuyển trang để guard rời trang không hỏi lại.
    uploading.value = false
    await navigateTo(`/videos/${data.uploadVideo.id}`)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      formError.value = 'Đã hủy tải lên.'
    } else if (e instanceof GraphqlError && Object.keys(e.validation).length) {
      errors.file = e.validation.file?.[0]
      errors.title = e.validation.title?.[0]
      formError.value = e.message
    } else {
      formError.value = errorMessage(e)
    }
  } finally {
    uploading.value = false
    controller.value = null
  }
}
</script>
