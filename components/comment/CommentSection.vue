<template>
  <section aria-labelledby="comments-heading" class="mt-8">
    <h2 id="comments-heading" class="text-lg font-semibold">
      {{ total === null ? 'Bình luận' : `${total.toLocaleString('vi-VN')} bình luận` }}
    </h2>

    <CommentComposer
      ref="composer"
      class="mt-4"
      label="Viết bình luận"
      :video-id="videoId"
      :busy="sending"
      :error="sendError"
      @submit="send"
      @cancel="cancelComposer"
    />

    <div v-if="loading && !comments.length" class="mt-6 space-y-5" aria-busy="true">
      <div v-for="i in 3" :key="i" class="flex gap-3">
        <div class="h-9 w-9 animate-pulse rounded-full bg-surface-2" />
        <div class="flex-1 space-y-2">
          <div class="h-3 w-32 animate-pulse rounded bg-surface-2" />
          <div class="h-3 w-3/4 animate-pulse rounded bg-surface-2" />
        </div>
      </div>
    </div>

    <p v-else-if="!loadError && !comments.length" class="mt-6 text-sm text-muted">Chưa có bình luận nào. Hãy là người đầu tiên!</p>

    <ul v-if="comments.length" class="mt-6 space-y-6">
      <CommentThread
        v-for="comment in comments"
        :key="comment.id"
        :root="comment"
        :video-id="videoId"
        :video-owner-id="videoOwnerId"
        :me-id="meId"
        @updated="replaceRoot"
        @deleted="onDeleted"
        @replied="total = (total ?? 0) + 1"
      />
    </ul>

    <FormAlert v-if="loadError" class="mt-4">
      {{ loadError }}
      <button type="button" class="ml-1 font-semibold underline" @click="loadMore">Thử lại</button>
    </FormAlert>

    <div v-if="hasMore && comments.length" class="mt-6 flex justify-center">
      <button type="button" class="btn-ghost" :disabled="loading" @click="loadMore">
        <ArrowPathIcon v-if="loading" class="h-4 w-4 animate-spin" aria-hidden="true" />
        Xem thêm bình luận
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { COMMENT_PAGE_SIZE, CREATE_COMMENT_MUTATION, VIDEO_COMMENTS_QUERY, errorMessage } from '~/utils/api'
import type { Comment, Page } from '~/utils/api'

const props = defineProps<{ videoId: string; videoOwnerId: string; meId?: string }>()

const { query } = useGraphql()
const composer = ref<{ reset: () => void }>()

/** Bình luận gốc, mới nhất trước. */
const comments = ref<Comment[]>([])
/** Tổng số bình luận (gồm trả lời). */
const total = ref<number | null>(null)
const page = ref(0)
const hasMore = ref(true)
const loading = ref(false)
const loadError = ref('')

const sending = ref(false)
const sendError = ref('')

async function loadMore() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await query<{ video: { comments_count: number; comments: Page<Comment> } | null }>(VIDEO_COMMENTS_QUERY, {
      id: props.videoId,
      first: COMMENT_PAGE_SIZE,
      page: page.value + 1,
    })
    if (!data.video) return
    // Bỏ trùng: bình luận mới (của mình hoặc người khác) đẩy phần tử cũ sang trang sau.
    const known = new Set(comments.value.map((c) => c.id))
    comments.value.push(...data.video.comments.data.filter((c) => !known.has(c.id)))
    total.value = data.video.comments_count
    page.value = data.video.comments.paginatorInfo.currentPage
    hasMore.value = data.video.comments.paginatorInfo.hasMorePages
  } catch (e) {
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function send(body: string) {
  sending.value = true
  sendError.value = ''
  try {
    const data = await query<{ createComment: Comment }>(CREATE_COMMENT_MUTATION, { video_id: props.videoId, body })
    comments.value.unshift(data.createComment)
    total.value = (total.value ?? 0) + 1
    composer.value?.reset()
  } catch (e) {
    sendError.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

function cancelComposer() {
  sendError.value = ''
  composer.value?.reset()
}

function replaceRoot(updated: Comment) {
  const index = comments.value.findIndex((c) => c.id === updated.id)
  if (index !== -1) comments.value[index] = updated
}

function onDeleted(removed: Comment) {
  if (removed.parent_id) {
    total.value = Math.max(0, (total.value ?? 1) - 1)
    return
  }
  // Xóa bình luận gốc thì BE xóa luôn mọi trả lời của nó.
  comments.value = comments.value.filter((c) => c.id !== removed.id)
  total.value = Math.max(0, (total.value ?? 0) - 1 - removed.replies_count)
}

onMounted(loadMore)
</script>
