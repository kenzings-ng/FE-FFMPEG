<template>
  <div class="mx-auto max-w-6xl">
    <!-- Đang tải kênh -->
    <div v-if="loading && !channel" class="flex items-center gap-5" aria-busy="true">
      <div class="h-20 w-20 animate-pulse rounded-full bg-surface-2 sm:h-28 sm:w-28" />
      <div class="flex-1 space-y-3">
        <div class="h-7 w-48 animate-pulse rounded bg-surface-2" />
        <div class="h-4 w-64 animate-pulse rounded bg-surface-2" />
      </div>
    </div>

    <StateMessage
      v-else-if="loadError"
      tone="danger"
      :title="notFound ? 'Không tìm thấy kênh' : 'Không tải được kênh'"
      :description="notFound ? `Không có người dùng nào với tên @${requested}.` : loadError"
    >
      <button v-if="!notFound" type="button" class="btn-ghost" @click="loadChannel">Thử lại</button>
      <NuxtLink to="/" class="btn-primary">Về thư viện</NuxtLink>
    </StateMessage>

    <template v-else-if="channel">
      <!-- Đầu kênh -->
      <header class="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar :user="channel" size="xl" />
        <div class="min-w-0 flex-1">
          <h1 class="break-words text-2xl font-bold tracking-tight sm:text-4xl">{{ channel.name }}</h1>
          <p class="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted">
            <span class="font-medium text-fg">@{{ channel.username }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ channel.videos_count.toLocaleString('vi-VN') }} video</span>
            <span aria-hidden="true">·</span>
            <span>Tham gia {{ formatDate(channel.created_at) }}</span>
          </p>
          <button
            v-if="channel.bio"
            type="button"
            class="mt-2 block max-w-2xl text-left text-sm text-muted hover:text-fg"
            @click="tab = 'about'"
          >
            <span class="line-clamp-2 whitespace-pre-line break-words">{{ channel.bio }}</span>
            <span class="font-medium text-fg">Xem thêm</span>
          </button>
          <NuxtLink v-if="isMine" to="/profile" class="btn-ghost mt-4">
            <PencilSquareIcon class="h-4 w-4" aria-hidden="true" />
            Chỉnh sửa hồ sơ
          </NuxtLink>
        </div>
      </header>

      <!-- Tab -->
      <div class="mt-8 border-b border-line" role="tablist" aria-label="Nội dung kênh">
        <button
          v-for="item in tabs"
          :id="`tab-${item.key}`"
          :key="item.key"
          type="button"
          role="tab"
          :aria-selected="tab === item.key"
          :aria-controls="`panel-${item.key}`"
          :class="[
            '-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold',
            tab === item.key ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
          ]"
          @click="tab = item.key"
        >
          {{ item.label }}
        </button>
      </div>

      <!-- Tab Video -->
      <section v-if="tab === 'videos'" id="panel-videos" role="tabpanel" aria-labelledby="tab-videos" class="mt-6">
        <div v-if="videosLoading && !videos.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          <div v-for="i in 3" :key="i" class="card overflow-hidden">
            <div class="aspect-video animate-pulse bg-surface-2" />
            <div class="space-y-2 p-4">
              <div class="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
              <div class="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
            </div>
          </div>
        </div>

        <StateMessage v-else-if="videosError && !videos.length" tone="danger" title="Không tải được video" :description="videosError">
          <button type="button" class="btn-ghost" @click="loadVideos">Thử lại</button>
        </StateMessage>

        <StateMessage
          v-else-if="!videos.length"
          title="Kênh chưa có video công khai"
          :description="isMine ? 'Video ở chế độ riêng tư hoặc đang xử lý không hiện ở đây.' : undefined"
        >
          <NuxtLink v-if="isMine" to="/upload" class="btn-primary">Tải video lên</NuxtLink>
        </StateMessage>

        <template v-else>
          <ul class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <li v-for="video in videos" :key="video.id">
              <VideoCard :video="video" :current-user-id="user?.id" hide-channel />
            </li>
          </ul>
          <FormAlert v-if="videosError" class="mt-4">{{ videosError }}</FormAlert>
          <div v-if="hasMore" class="mt-8 flex justify-center">
            <button type="button" class="btn-ghost" :disabled="videosLoading" @click="loadVideos">
              <ArrowPathIcon v-if="videosLoading" class="h-4 w-4 animate-spin" aria-hidden="true" />
              Xem thêm video
            </button>
          </div>
        </template>
      </section>

      <!-- Tab Giới thiệu -->
      <section v-else id="panel-about" role="tabpanel" aria-labelledby="tab-about" class="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div>
          <h2 class="font-semibold">Giới thiệu</h2>
          <!-- Text thuần (interpolation tự escape), giữ xuống dòng. -->
          <p v-if="channel.bio" class="mt-3 whitespace-pre-line break-words text-sm leading-relaxed">{{ channel.bio }}</p>
          <p v-else class="mt-3 text-sm text-muted">
            {{ isMine ? 'Bạn chưa viết phần giới thiệu.' : 'Kênh này chưa có phần giới thiệu.' }}
            <NuxtLink v-if="isMine" to="/profile" class="font-medium text-accent hover:underline">Viết ngay</NuxtLink>
          </p>
        </div>
        <dl class="card space-y-3 p-4 text-sm">
          <div>
            <dt class="text-muted">Tên người dùng</dt>
            <dd class="font-medium">@{{ channel.username }}</dd>
          </div>
          <div>
            <dt class="text-muted">Tham gia</dt>
            <dd class="font-medium">{{ formatDate(channel.created_at) }}</dd>
          </div>
          <div>
            <dt class="text-muted">Video công khai</dt>
            <dd class="font-medium">{{ channel.videos_count.toLocaleString('vi-VN') }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon, PencilSquareIcon } from '@heroicons/vue/24/outline'
import { CHANNEL_QUERY, CHANNEL_VIDEOS_QUERY, channelPath, errorMessage, formatDate } from '~/utils/api'
import type { Channel, Page, Video } from '~/utils/api'
import { normalizeUsername } from '~/utils/username'

const route = useRoute()
const router = useRouter()
const { query } = useGraphql()
const { user } = useAccount()

const requested = computed(() => normalizeUsername(String(route.params.username ?? '')))

const channel = ref<Channel | null>(null)
const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const isMine = computed(() => !!channel.value && channel.value.id === user.value?.id)

const tabs = [
  { key: 'videos', label: 'Video' },
  { key: 'about', label: 'Giới thiệu' },
] as const
type Tab = (typeof tabs)[number]['key']
// Tab nằm trên URL (?tab=about) để chia sẻ link / back được.
const tab = computed<Tab>({
  get: () => (route.query.tab === 'about' ? 'about' : 'videos'),
  set: (value) => router.replace({ query: { ...route.query, tab: value === 'videos' ? undefined : value } }),
})

useHead({ title: () => (channel.value ? `${channel.value.name} (@${channel.value.username}) · FFmpeg Stream` : 'Kênh · FFmpeg Stream') })

async function loadChannel() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  try {
    const data = await query<{ userByUsername: Channel | null }>(CHANNEL_QUERY, { username: requested.value })
    const found = data.userByUsername
    if (!found) {
      notFound.value = true
      loadError.value = 'not-found'
      channel.value = null
      return
    }
    // Gán trước khi đổi URL: watch(requested) thấy đúng kênh đang mở thì không tải lại.
    channel.value = found
    // Link cũ (handle vừa đổi) hoặc gõ hoa / có '@': chuyển sang URL chuẩn.
    if (found.username !== String(route.params.username)) {
      await router.replace({ path: channelPath(found.username), query: route.query })
    }
  } catch (e) {
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

// ---- Tab Video ----
const VIDEO_PAGE_SIZE = 24
const videos = ref<Video[]>([])
const page = ref(0)
const hasMore = ref(true)
const videosLoading = ref(false)
const videosError = ref('')

async function loadVideos() {
  if (!channel.value) return
  videosLoading.value = true
  videosError.value = ''
  try {
    const data = await query<{ userByUsername: { videos: Page<Video> } | null }>(CHANNEL_VIDEOS_QUERY, {
      username: channel.value.username,
      first: VIDEO_PAGE_SIZE,
      page: page.value + 1,
    })
    const result = data.userByUsername?.videos
    if (!result) return
    const known = new Set(videos.value.map((v) => v.id))
    videos.value.push(...result.data.filter((v) => !known.has(v.id)))
    page.value = result.paginatorInfo.currentPage
    hasMore.value = result.paginatorInfo.hasMorePages
  } catch (e) {
    videosError.value = errorMessage(e)
  } finally {
    videosLoading.value = false
  }
}

function resetVideos() {
  videos.value = []
  page.value = 0
  hasMore.value = true
}

// Đổi sang kênh khác (bấm @handle khi đang ở một trang kênh): tải lại từ đầu.
watch(
  requested,
  async (value, old) => {
    if (old !== undefined && channel.value && value === channel.value.username) return
    resetVideos()
    await loadChannel()
    if (channel.value) await loadVideos()
  },
  { immediate: true },
)
</script>
