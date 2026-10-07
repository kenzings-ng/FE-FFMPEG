<template>
  <li>
    <CommentItem
      :comment="root"
      :me-id="meId"
      :video-owner-id="videoOwnerId"
      :video-id="videoId"
      @reply="openReply"
      @updated="(c: Comment) => emit('updated', c)"
      @deleted="(c: Comment) => emit('deleted', c)"
    >
      <!-- Ô trả lời: trả lời gốc hoặc một trả lời đều nằm trong luồng này (BE chỉ có 2 tầng). -->
      <CommentComposer
        v-if="replyTo"
        :key="replyTo.id"
        class="mt-3"
        :label="`Trả lời ${replyTo.user.name}`"
        :placeholder="`Trả lời @${replyTo.user.username}…`"
        submit-label="Phản hồi"
        :initial="replyPrefill"
        :video-id="videoId"
        :busy="sending"
        :error="sendError"
        autofocus
        always-expanded
        @submit="sendReply"
        @cancel="closeReply"
      />

      <button
        v-if="hiddenCount > 0 || (showReplies && repliesCount > 0)"
        type="button"
        class="mt-2 inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent hover:bg-accent/10"
        :aria-expanded="showReplies"
        :disabled="loading"
        @click="toggleReplies"
      >
        <ChevronDownIcon :class="['h-4 w-4 transition-transform', showReplies && 'rotate-180']" aria-hidden="true" />
        {{ showReplies ? 'Ẩn phản hồi' : `${hiddenCount} phản hồi` }}
      </button>

      <ul v-if="showReplies || replies.length" class="mt-3 space-y-4">
        <li v-for="reply in replies" :key="reply.id">
          <CommentItem
            :comment="reply"
            :me-id="meId"
            :video-owner-id="videoOwnerId"
            :video-id="videoId"
            compact
            @reply="openReply"
            @updated="replaceReply"
            @deleted="removeReply"
          />
        </li>
      </ul>

      <button v-if="showReplies && hasMore" type="button" class="comment-action mt-2" :disabled="loading" @click="loadReplies">
        {{ loading ? 'Đang tải…' : 'Xem thêm phản hồi' }}
      </button>
      <FormAlert v-if="loadError" class="mt-2">{{ loadError }}</FormAlert>
    </CommentItem>
  </li>
</template>

<script setup lang="ts">
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import { COMMENT_PAGE_SIZE, COMMENT_REPLIES_QUERY, CREATE_COMMENT_MUTATION, errorMessage } from '~/utils/api'
import type { Comment, Page } from '~/utils/api'

const props = defineProps<{ root: Comment; videoId: string; videoOwnerId: string; meId?: string }>()
const emit = defineEmits<{ updated: [comment: Comment]; deleted: [comment: Comment]; replied: [] }>()

const { query } = useGraphql()

/** Trả lời đã tải từ BE (theo trang, cũ nhất trước). */
const loaded = ref<Comment[]>([])
/** Trả lời mình vừa gửi khi danh sách đang ẩn: vẫn hiện ngay bên dưới. */
const mine = ref<Comment[]>([])
const page = ref(0)
const hasMore = ref(true)
const loading = ref(false)
const loadError = ref('')
const showReplies = ref(false)

const replyTo = ref<Comment | null>(null)
/**
 * Trả lời một trả lời: điền sẵn "@handle " của người đó (như YouTube), vì mọi
 * trả lời nằm chung một luồng. Trả lời bình luận gốc hoặc chính mình thì không cần.
 */
const replyPrefill = computed(() =>
  replyTo.value?.parent_id && replyTo.value.user.id !== props.meId ? `@${replyTo.value.user.username} ` : '',
)
const sending = ref(false)
const sendError = ref('')

const repliesCount = computed(() => props.root.replies_count)
const replies = computed(() => (showReplies.value ? loaded.value : mine.value))
/** Số trả lời chưa hiện (nút "N phản hồi"). */
const hiddenCount = computed(() => (showReplies.value ? 0 : repliesCount.value - mine.value.length))

async function loadReplies() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await query<{ comment: { replies: Page<Comment> } | null }>(COMMENT_REPLIES_QUERY, {
      id: props.root.id,
      first: COMMENT_PAGE_SIZE,
      page: page.value + 1,
    })
    const result = data.comment?.replies
    if (!result) return
    // Bỏ trùng: trả lời mới (của người khác) có thể đẩy phần tử sang trang sau.
    const known = new Set(loaded.value.map((c) => c.id))
    loaded.value.push(...result.data.filter((c) => !known.has(c.id)))
    page.value = result.paginatorInfo.currentPage
    hasMore.value = result.paginatorInfo.hasMorePages
  } catch (e) {
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function toggleReplies() {
  if (showReplies.value) {
    showReplies.value = false
    return
  }
  showReplies.value = true
  mine.value = []
  if (page.value === 0) await loadReplies()
}

function openReply(target: Comment) {
  sendError.value = ''
  replyTo.value = target
}

function closeReply() {
  replyTo.value = null
  sendError.value = ''
}

async function sendReply(body: string) {
  if (!replyTo.value) return
  sending.value = true
  sendError.value = ''
  try {
    const data = await query<{ createComment: Comment }>(CREATE_COMMENT_MUTATION, {
      video_id: props.videoId,
      body,
      reply_to_id: replyTo.value.id,
    })
    // Đã mở danh sách và tải hết: thêm vào cuối (đúng thứ tự cũ → mới). Chưa
    // tải hết thì trả lời mới sẽ có ở trang cuối, chỉ hiện tạm ở "mine".
    if (showReplies.value && !hasMore.value) loaded.value.push(data.createComment)
    else if (!showReplies.value) mine.value.push(data.createComment)
    emit('updated', { ...props.root, replies_count: props.root.replies_count + 1 })
    emit('replied')
    replyTo.value = null
  } catch (e) {
    sendError.value = errorMessage(e)
  } finally {
    sending.value = false
  }
}

function replaceReply(updated: Comment) {
  for (const list of [loaded, mine]) {
    const index = list.value.findIndex((c) => c.id === updated.id)
    if (index !== -1) list.value[index] = updated
  }
}

function removeReply(removed: Comment) {
  loaded.value = loaded.value.filter((c) => c.id !== removed.id)
  mine.value = mine.value.filter((c) => c.id !== removed.id)
  if (replyTo.value?.id === removed.id) closeReply()
  emit('updated', { ...props.root, replies_count: Math.max(0, props.root.replies_count - 1) })
  emit('deleted', removed)
}
</script>
