<template>
  <article class="flex gap-3" :aria-label="`Bình luận của ${comment.user.name}`">
    <NuxtLink :to="channelPath(comment.user.username)" class="shrink-0 self-start rounded-full" tabindex="-1" aria-hidden="true">
      <UserAvatar :user="comment.user" :size="compact ? 'xs' : 'md'" />
    </NuxtLink>

    <div class="min-w-0 flex-1">
      <p class="flex flex-wrap items-baseline gap-x-2 text-sm">
        <NuxtLink :to="channelPath(comment.user.username)" class="font-semibold hover:underline">{{ comment.user.name }}</NuxtLink>
        <NuxtLink :to="channelPath(comment.user.username)" class="text-xs text-muted hover:underline">@{{ comment.user.username }}</NuxtLink>
        <span v-if="isVideoOwner" class="rounded bg-surface-2 px-1.5 text-xs text-muted">Tác giả</span>
        <time class="text-xs text-muted" :datetime="parseServerDate(comment.created_at).toISOString()" :title="formatDate(comment.created_at)">
          {{ formatRelative(comment.created_at) }}
        </time>
        <span v-if="comment.edited_at" class="text-xs text-muted">(đã chỉnh sửa)</span>
      </p>

      <CommentComposer
        v-if="editing"
        class="mt-2"
        label="Sửa bình luận"
        submit-label="Lưu"
        :initial="editableBody"
        :busy="busy === 'edit'"
        :error="error"
        :video-id="videoId"
        autofocus
        always-expanded
        @submit="save"
        @cancel="cancelEdit"
      />
      <!-- Text thuần: interpolation tự escape (KHÔNG v-html), giữ xuống dòng bằng whitespace-pre-line.
           Nhắc tên: chỉ những lần BE xác nhận (comment.mentions), hiện handle HIỆN TẠI của người được nhắc. -->
      <p v-else class="mt-1 whitespace-pre-line break-words text-sm leading-relaxed">
        <template v-for="(segment, index) in segments" :key="index"><NuxtLink v-if="segment.user" :to="channelPath(segment.user.username)" class="font-medium text-accent hover:underline" :title="segment.user.name">{{ segment.text }}</NuxtLink><template v-else>{{ segment.text }}</template></template>
      </p>

      <div v-if="!editing" class="mt-1 flex flex-wrap items-center gap-1 text-xs">
        <button type="button" class="comment-action" @click="emit('reply', comment)">Phản hồi</button>
        <button v-if="canEdit" type="button" class="comment-action" @click="startEdit">Sửa</button>
        <button v-if="canDelete" type="button" class="comment-action hover:text-danger" @click="confirmDelete = true">Xóa</button>
      </div>
      <FormAlert v-if="error && !editing" class="mt-2">{{ error }}</FormAlert>

      <slot />
    </div>

    <ConfirmDialog
      :open="confirmDelete"
      title="Xóa bình luận này?"
      confirm-label="Xóa"
      tone="danger"
      :loading="busy === 'delete'"
      @cancel="confirmDelete = false"
      @confirm="remove"
    >
      <template v-if="!comment.parent_id && comment.replies_count > 0">
        Bình luận và {{ comment.replies_count }} phản hồi của nó sẽ bị xóa. Không thể hoàn tác.
      </template>
      <template v-else>Bình luận sẽ bị xóa vĩnh viễn. Không thể hoàn tác.</template>
    </ConfirmDialog>
  </article>
</template>

<script setup lang="ts">
import { DELETE_COMMENT_MUTATION, UPDATE_COMMENT_MUTATION, channelPath, errorMessage, formatDate, formatRelative, parseServerDate } from '~/utils/api'
import type { Comment } from '~/utils/api'
import { splitMentions, withCurrentHandles } from '~/utils/username'

const props = defineProps<{
  comment: Comment
  /** Người đang xem. */
  meId?: string
  videoOwnerId: string
  /** Bật gợi ý "@" khi sửa. */
  videoId?: string
  /** Trả lời: avatar nhỏ hơn. */
  compact?: boolean
}>()
const emit = defineEmits<{ reply: [comment: Comment]; updated: [comment: Comment]; deleted: [comment: Comment] }>()

const { query } = useGraphql()
const editing = ref(false)
const confirmDelete = ref(false)
const busy = ref<'edit' | 'delete' | null>(null)
const error = ref('')

const segments = computed(() => splitMentions(props.comment.body, props.comment.mentions))
/** Mở ô sửa với handle hiện tại; lưu lại thì BE nhận diện lại lần nhắc tên. */
const editableBody = computed(() => withCurrentHandles(props.comment.body, props.comment.mentions))
const isVideoOwner = computed(() => props.comment.user.id === props.videoOwnerId)
// Khớp CommentPolicy ở BE: sửa = người viết; xóa = người viết hoặc chủ video.
const canEdit = computed(() => !!props.meId && props.comment.user.id === props.meId)
const canDelete = computed(() => canEdit.value || (!!props.meId && props.meId === props.videoOwnerId))

function startEdit() {
  error.value = ''
  editing.value = true
}

function cancelEdit() {
  error.value = ''
  editing.value = false
}

async function save(body: string) {
  busy.value = 'edit'
  error.value = ''
  try {
    const data = await query<{ updateComment: Comment }>(UPDATE_COMMENT_MUTATION, { id: props.comment.id, body })
    emit('updated', data.updateComment)
    editing.value = false
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = null
  }
}

async function remove() {
  busy.value = 'delete'
  error.value = ''
  try {
    await query(DELETE_COMMENT_MUTATION, { id: props.comment.id })
    confirmDelete.value = false
    emit('deleted', props.comment)
  } catch (e) {
    confirmDelete.value = false
    error.value = errorMessage(e)
  } finally {
    busy.value = null
  }
}
</script>

<style>
.comment-action {
  @apply min-h-8 rounded-md px-2 font-medium text-muted hover:bg-surface-2 hover:text-fg;
}
</style>
