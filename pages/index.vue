<template>
  <div>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Thư viện video</h1>
        <p class="mt-1 text-sm text-muted">
          Video công khai và video riêng tư của bạn<template v-if="paginator">
            · <span class="tabular-nums">{{ paginator.total }}</span> video</template
          >.
        </p>
      </div>

      <div role="radiogroup" aria-label="Lọc video" class="inline-flex self-start rounded-lg border border-line bg-surface p-1">
        <button
          v-for="option in filters"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="filter === option.value"
          :class="[
            'min-h-9 cursor-pointer rounded-md px-3 text-sm font-medium transition-colors',
            filter === option.value ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
          ]"
          @click="filter = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="status === 'pending' && !videos.length" class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      <div v-for="i in 6" :key="i" class="card overflow-hidden">
        <div class="aspect-video animate-pulse bg-surface-2" />
        <div class="space-y-2 p-4">
          <div class="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
          <div class="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    </div>

    <StateMessage v-else-if="status === 'error' && !videos.length" tone="danger" title="Không tải được danh sách video" :description="errorMessage(error)">
      <button type="button" class="btn-ghost" @click="reload">Thử lại</button>
    </StateMessage>

    <StateMessage
      v-else-if="!filtered.length && !paginator?.hasMorePages"
      :icon="FilmIcon"
      :title="filter === 'mine' || !videos.length ? 'Bạn chưa có video nào' : 'Không có video công khai nào'"
      description="Tải video lên để máy chủ chuyển sang HLS nhiều chất lượng."
    >
      <NuxtLink to="/upload" class="btn-primary">
        <ArrowUpTrayIcon class="h-4 w-4" aria-hidden="true" />
        Tải video lên
      </NuxtLink>
    </StateMessage>

    <template v-else>
      <ul class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="video in filtered" :key="video.id">
          <VideoCard :video="video" :current-user-id="user?.id" />
        </li>
      </ul>

      <p v-if="filter !== 'all' && !filtered.length" class="mt-8 text-center text-sm text-muted">
        Chưa có video phù hợp trong {{ videos.length }} video đã tải. Tải thêm để tìm tiếp.
      </p>

      <div v-if="paginator?.hasMorePages" class="mt-8 flex flex-col items-center gap-2">
        <button type="button" class="btn-ghost" :disabled="status === 'pending'" @click="loadMore">
          <ArrowPathIcon v-if="status === 'pending'" class="h-4 w-4 animate-spin" aria-hidden="true" />
          {{ status === 'pending' ? 'Đang tải…' : 'Tải thêm video' }}
        </button>
        <p class="text-xs tabular-nums text-muted">Đã hiển thị {{ videos.length }}/{{ paginator.total }}</p>
        <p v-if="status === 'error'" role="alert" class="text-sm text-danger">{{ errorMessage(error) }}</p>
      </div>
    </template>

    <p v-if="inProgress.length" class="mt-6 text-center text-sm text-muted" aria-live="polite">
      {{ inProgress.length }} video đang chờ hoặc đang xử lý — trạng thái tự cập nhật.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ArrowPathIcon, ArrowUpTrayIcon, FilmIcon } from '@heroicons/vue/24/outline'
import type { PaginatorInfo, Video } from '~/utils/api'

useHead({ title: 'Thư viện · FFmpeg Stream' })

type Filter = 'all' | 'mine' | 'public'

const PAGE_SIZE = 12

const { query } = useGraphql()
const { user } = useAccount()
const route = useRoute()

const videos = ref<Video[]>([])
const paginator = ref<PaginatorInfo | null>(null)
const status = ref<'pending' | 'success' | 'error'>('pending')
const error = ref<unknown>(null)

// Bộ lọc nằm trên URL (?filter=mine) để chia sẻ link / back được. BE chưa có
// argument lọc nên lọc trên các trang đã tải về.
const filter = computed<Filter>({
  get: () => (['mine', 'public'].includes(route.query.filter as string) ? (route.query.filter as Filter) : 'all'),
  set: (value) => navigateTo({ query: value === 'all' ? {} : { filter: value } }, { replace: true }),
})

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'mine', label: 'Của tôi' },
  { value: 'public', label: 'Công khai' },
]

const predicates: Record<Filter, (v: Video) => boolean> = {
  all: () => true,
  mine: (v) => v.user.id === user.value?.id,
  public: (v) => v.is_public,
}

const filtered = computed(() => videos.value.filter(predicates[filter.value]))
const inProgress = computed(() => videos.value.filter(isInProgress))

async function fetchPage(page: number) {
  status.value = 'pending'
  try {
    const data = await query<{ videos: { data: Video[]; paginatorInfo: PaginatorInfo } }>(VIDEOS_QUERY, {
      first: PAGE_SIZE,
      page,
    })
    // Bỏ trùng phòng khi danh sách thay đổi giữa hai lần tải trang.
    const seen = new Set(videos.value.map((v) => v.id))
    videos.value = page === 1 ? data.videos.data : [...videos.value, ...data.videos.data.filter((v) => !seen.has(v.id))]
    paginator.value = data.videos.paginatorInfo
    error.value = null
    status.value = 'success'
  } catch (e) {
    error.value = e
    status.value = 'error'
  }
}

const reload = () => fetchPage(1)
const loadMore = () => fetchPage((paginator.value?.currentPage ?? 0) + 1)

/**
 * Chỉ hỏi lại đúng các video đang PENDING/PROCESSING thay vì tải lại cả danh
 * sách đã phân trang (thường chỉ 1–2 video, BE encode tuần tự từng video).
 */
async function refreshInProgress() {
  const ids = inProgress.value.map((v) => v.id)
  const results = await Promise.allSettled(ids.map((id) => query<{ video: Video | null }>(VIDEO_QUERY, { id })))
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') return
    const id = ids[i]
    // null: video đã bị xóa ở nơi khác.
    const fresh = result.value.video
    videos.value = fresh
      ? videos.value.map((v) => (v.id === fresh.id ? fresh : v))
      : videos.value.filter((v) => v.id !== id)
  })
}

const { pause, resume } = usePolling(refreshInProgress, 15_000)
watch(
  () => inProgress.value.length,
  (n) => (n ? resume() : pause()),
)

onMounted(reload)
</script>
