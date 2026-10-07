<template>
  <div class="mx-auto max-w-5xl">
    <NuxtLink to="/" class="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-muted hover:text-fg">
      <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
      Thư viện
    </NuxtLink>

    <div v-if="loading && !video" class="mt-4 space-y-4" aria-busy="true">
      <div class="aspect-video animate-pulse rounded-xl bg-surface-2" />
      <div class="h-7 w-1/2 animate-pulse rounded bg-surface-2" />
    </div>

    <StateMessage
      v-else-if="loadError"
      tone="danger"
      :title="notFound ? 'Không tìm thấy video' : 'Không tải được video'"
      :description="notFound ? 'Video không tồn tại, đã bị xóa hoặc bạn không có quyền xem.' : loadError"
    >
      <button v-if="!notFound" type="button" class="btn-ghost" @click="load">Thử lại</button>
      <NuxtLink to="/" class="btn-primary">Về thư viện</NuxtLink>
    </StateMessage>

    <template v-else-if="video">
      <div class="mt-4">
        <VideoPlayer
          v-if="video.status === 'READY' && video.hls_url"
          :key="video.hls_url"
          :src="video.hls_url"
          :title="video.title"
          :poster="video.poster_url"
          :stream="video.stream"
          :refresh-stream="video.stream ? refreshStream : undefined"
          @error="onPlayerError"
        />
        <div
          v-else
          class="flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 text-center"
          aria-live="polite"
        >
          <component :is="placeholder.icon" :class="['h-8 w-8', placeholder.iconClass]" aria-hidden="true" />
          <p class="font-semibold">{{ placeholder.title }}</p>
          <p class="max-w-md text-sm text-muted">{{ placeholder.description }}</p>
        </div>
        <FormAlert v-if="playerError" class="mt-3">{{ playerError }}</FormAlert>
      </div>

      <div class="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <!-- Đổi tiêu đề tại chỗ (chỉ chủ sở hữu). -->
          <form v-if="editing" class="space-y-3" novalidate @submit.prevent="saveTitle">
            <FormTextField
              id="title"
              v-model.trim="titleDraft"
              label="Tiêu đề"
              autocomplete="off"
              :maxlength="TITLE_MAX"
              :error="titleForm.fieldErrors.title"
              @keydown.esc="editing = false"
            />
            <FormAlert v-if="titleForm.formError.value">{{ titleForm.formError.value }}</FormAlert>
            <div class="flex gap-2">
              <button type="submit" class="btn-primary" :disabled="busy !== null">
                <ArrowPathIcon v-if="busy === 'title'" class="h-4 w-4 animate-spin" aria-hidden="true" />
                Lưu
              </button>
              <button type="button" class="btn-ghost" :disabled="busy !== null" @click="editing = false">Hủy</button>
            </div>
          </form>
          <div v-else class="flex items-start gap-2">
            <h1 class="min-w-0 break-words text-2xl font-semibold tracking-tight">{{ video.title }}</h1>
            <button
              v-if="isOwner"
              type="button"
              class="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
              aria-label="Đổi tiêu đề"
              @click="startEditing"
            >
              <PencilSquareIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span v-if="isOwner">Video của bạn</span>
            <span v-else>
              Đăng bởi
              <NuxtLink :to="channelPath(video.user.username)" class="font-medium text-fg hover:underline">{{ video.user.name }}</NuxtLink>
            </span>
            <span aria-hidden="true">·</span>
            <time :datetime="parseServerDate(video.created_at).toISOString()" :title="formatDate(video.created_at)">
              {{ formatRelative(video.created_at) }}
            </time>
            <VideoStatusBadge :kind="video.is_public ? 'public' : 'private'" />
            <VideoStatusBadge v-if="video.status !== 'READY'" :kind="video.status" />
          </div>
        </div>

        <section v-if="isOwner" aria-labelledby="owner-tools" class="card w-full shrink-0 p-4 lg:w-80">
          <h2 id="owner-tools" class="text-sm font-semibold">Quản lý video</h2>

          <SwitchGroup as="div" class="mt-4 flex items-start justify-between gap-4">
            <div>
              <SwitchLabel class="text-sm font-medium">Công khai</SwitchLabel>
              <SwitchDescription class="mt-0.5 text-xs text-muted">
                {{ video.is_public ? 'Mọi người đăng nhập đều xem được.' : 'Chỉ bạn xem được, link phát hết hạn sau 30 phút.' }}
              </SwitchDescription>
            </div>
            <Switch
              :model-value="video.is_public"
              :disabled="busy !== null"
              :class="[
                video.is_public ? 'bg-accent' : 'bg-surface-2 ring-1 ring-inset ring-line',
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-wait disabled:opacity-60',
              ]"
              @update:model-value="setVisibility"
            >
              <span
                aria-hidden="true"
                :class="[
                  video.is_public ? 'translate-x-5' : 'translate-x-0.5',
                  'pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                ]"
              />
            </Switch>
          </SwitchGroup>

          <template v-if="video.status === 'FAILED'">
            <div class="my-4 h-px bg-line" />
            <button type="button" class="btn-primary w-full" :disabled="busy !== null" @click="reprocess">
              <ArrowPathIcon :class="['h-4 w-4', busy === 'segment' && 'animate-spin']" aria-hidden="true" />
              Thử xử lý lại
            </button>
            <p class="mt-2 text-xs text-muted">Máy chủ đã thử lại tự động nhưng vẫn lỗi. Đưa video vào hàng đợi một lần nữa.</p>
          </template>

          <div class="my-4 h-px bg-line" />
          <button type="button" class="btn-ghost w-full text-danger" :disabled="busy !== null" @click="confirmDelete = true">
            <TrashIcon class="h-4 w-4" aria-hidden="true" />
            Xóa video
          </button>

          <FormAlert v-if="actionMessage" :tone="actionError ? 'danger' : 'success'" class="mt-3">{{ actionMessage }}</FormAlert>
        </section>
      </div>

      <CommentSection :key="video.id" :video-id="video.id" :video-owner-id="video.user.id" :me-id="user?.id" />

      <ConfirmDialog
        :open="confirmDelete"
        title="Xóa video này?"
        confirm-label="Xóa vĩnh viễn"
        tone="danger"
        :loading="busy === 'delete'"
        @cancel="confirmDelete = false"
        @confirm="deleteVideo"
      >
        “<span class="break-words font-medium text-fg">{{ video.title }}</span>” cùng toàn bộ file HLS sẽ bị xóa khỏi máy
        chủ. Không thể hoàn tác.
      </ConfirmDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Switch, SwitchDescription, SwitchGroup, SwitchLabel } from '@headlessui/vue'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline'
import { GraphqlError } from '~/utils/graphql'
import { channelPath } from '~/utils/api'
import type { Video, VideoStream } from '~/utils/api'

const route = useRoute()
const { query } = useGraphql()
const { user } = useAccount()

const id = computed(() => String(route.params.id))
const video = ref<Video | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const playerError = ref('')
const busy = ref<'title' | 'visibility' | 'segment' | 'delete' | null>(null)
const actionMessage = ref('')
const actionError = ref(false)
const confirmDelete = ref(false)
let refreshedForExpiry = false

const isOwner = computed(() => !!video.value && video.value.user.id === user.value?.id)

useHead({ title: () => (video.value ? `${video.value.title} · FFmpeg Stream` : 'Video · FFmpeg Stream') })

const placeholder = computed(() => {
  switch (video.value?.status) {
    case 'PENDING':
      return {
        icon: ClockIcon,
        iconClass: 'text-muted',
        title: 'Đang chờ tới lượt xử lý',
        description: 'Máy chủ encode lần lượt từng video. Trang sẽ tự cập nhật khi bắt đầu xử lý.',
      }
    case 'FAILED':
      return {
        icon: ExclamationTriangleIcon,
        iconClass: 'text-danger',
        title: 'Xử lý video thất bại',
        description: isOwner.value
          ? 'FFmpeg không encode được video này. Bấm “Thử xử lý lại”, hoặc xóa và tải lên file khác.'
          : 'Video này hiện không phát được.',
      }
    default:
      return {
        icon: ArrowPathIcon,
        iconClass: 'animate-spin text-warning',
        title: 'Máy chủ đang xử lý video',
        description: 'FFmpeg đang encode tối đa 3 mức chất lượng (480p → 1080p) và mã hóa AES-128. Trang sẽ tự cập nhật khi xong.',
      }
  }
})

async function load() {
  loading.value = true
  try {
    const data = await query<{ video: Video | null }>(VIDEO_QUERY, { id: id.value })
    notFound.value = !data.video
    loadError.value = data.video ? '' : 'not-found'
    video.value = data.video
  } catch (e) {
    notFound.value = e instanceof GraphqlError && e.isForbidden
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

/** Grant mới cho player (video trên CDN) khi stream token sắp hết hạn hoặc người xem đổi mạng. */
async function refreshStream(): Promise<VideoStream | null> {
  const data = await query<{ video: Pick<Video, 'stream'> | null }>(VIDEO_STREAM_QUERY, { id: id.value })
  return data.video?.stream ?? null
}

async function onPlayerError(reason: 'expired' | 'network' | 'media' | 'unsupported') {
  // Link ký của video private hết hạn sau 30 phút: lấy link mới đúng một lần.
  if (reason === 'expired' && !refreshedForExpiry) {
    refreshedForExpiry = true
    const previous = video.value?.hls_url
    await load()
    // URL mới sẽ remount player (:key); URL không đổi thì thử lại cũng vô ích.
    if (video.value?.hls_url !== previous) return
  }
  playerError.value = {
    expired: 'Link phát đã hết hạn hoặc bạn không còn quyền xem. Hãy tải lại trang.',
    network: 'Không tải được dữ liệu video. Kiểm tra kết nối rồi thử lại.',
    media: 'Trình duyệt không giải mã được video này.',
    unsupported: 'Trình duyệt không hỗ trợ phát HLS.',
  }[reason]
}

async function runAction(kind: 'visibility' | 'segment', action: () => Promise<Video>, success: string) {
  busy.value = kind
  actionMessage.value = ''
  try {
    video.value = await action()
    actionError.value = false
    actionMessage.value = success
  } catch (e) {
    actionError.value = true
    actionMessage.value = errorMessage(e)
  } finally {
    busy.value = null
  }
}

function setVisibility(isPublic: boolean) {
  runAction(
    'visibility',
    async () => (await query<{ setVideoVisibility: Video }>(SET_VISIBILITY_MUTATION, { id: id.value, is_public: isPublic })).setVideoVisibility,
    isPublic ? 'Đã chuyển sang công khai.' : 'Đã chuyển sang riêng tư.',
  )
}

function reprocess() {
  runAction(
    'segment',
    async () => (await query<{ segmentVideo: Video }>(SEGMENT_VIDEO_MUTATION, { id: id.value })).segmentVideo,
    'Đã đưa video vào hàng đợi xử lý.',
  )
}

// ---- Đổi tiêu đề ----
const editing = ref(false)
const titleDraft = ref('')
const titleForm = useFormErrors(['title'] as const)

function startEditing() {
  titleForm.reset()
  titleDraft.value = video.value?.title ?? ''
  editing.value = true
  nextTick(() => document.getElementById('title')?.focus())
}

async function saveTitle() {
  titleForm.reset()
  titleForm.set(
    'title',
    !titleDraft.value
      ? 'Vui lòng nhập tiêu đề.'
      : !TITLE_PATTERN.test(titleDraft.value)
        ? 'Tiêu đề không được chứa ký tự < hoặc >.'
        : undefined,
  )
  if (titleForm.focusFirst()) return
  if (titleDraft.value === video.value?.title) {
    editing.value = false
    return
  }

  busy.value = 'title'
  try {
    video.value = (await query<{ updateVideo: Video }>(UPDATE_VIDEO_MUTATION, { id: id.value, title: titleDraft.value })).updateVideo
    editing.value = false
  } catch (e) {
    titleForm.apply(e)
  } finally {
    busy.value = null
  }
}

// ---- Xóa ----
async function deleteVideo() {
  busy.value = 'delete'
  try {
    await query(DELETE_VIDEO_MUTATION, { id: id.value })
    confirmDelete.value = false
    await navigateTo('/', { replace: true })
  } catch (e) {
    confirmDelete.value = false
    actionError.value = true
    actionMessage.value = errorMessage(e)
  } finally {
    busy.value = null
  }
}

const { pause, resume } = usePolling(load, 10_000)
watch(
  () => !!video.value && isInProgress(video.value),
  (inProgress) => (inProgress ? resume() : pause()),
)

onMounted(load)
</script>
