<template>
  <form class="space-y-2" novalidate @submit.prevent="submit">
    <label :for="id" class="sr-only">{{ label }}</label>
    <div class="relative">
      <!-- Combobox (WAI-ARIA): gõ "@" mở danh sách gợi ý người để nhắc tên. -->
      <textarea
        :id="id"
        ref="textarea"
        v-model="text"
        class="input comment-textarea min-h-[2.75rem] w-full resize-none"
        :placeholder="placeholder"
        :maxlength="COMMENT_MAX"
        :disabled="busy"
        rows="1"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="menuOpen"
        :aria-controls="menuOpen ? listId : undefined"
        :aria-activedescendant="menuOpen && active >= 0 ? `${listId}-${active}` : undefined"
        @input="updateMention"
        @click="updateMention"
        @keyup="onKeyup"
        @keydown="onKeydown"
        @focus="focused = true"
        @blur="onBlur"
      />

      <ul
        v-if="menuOpen"
        :id="listId"
        role="listbox"
        :aria-label="`Gợi ý nhắc tên cho “@${mention?.query ?? ''}”`"
        class="card absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto overscroll-contain p-1 shadow-2xl"
      >
        <li
          v-for="(user, index) in suggestions"
          :id="`${listId}-${index}`"
          :key="user.id"
          role="option"
          :aria-selected="index === active"
          :class="['flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2', index === active && 'bg-surface-2']"
          @mousedown.prevent="pick(user)"
          @mousemove="active = index"
        >
          <UserAvatar :user="user" size="xs" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium">{{ user.name }}</span>
            <span class="block truncate text-xs text-muted">@{{ user.username }}</span>
          </span>
        </li>
        <li v-if="!suggestions.length" class="px-3 py-2 text-sm text-muted" role="presentation">
          {{ loadingSuggestions ? 'Đang tìm…' : 'Không tìm thấy người dùng' }}
        </li>
      </ul>
    </div>

    <FormAlert v-if="error">{{ error }}</FormAlert>
    <div v-if="expanded" class="flex flex-wrap items-center justify-end gap-2">
      <span v-if="videoId && !text" class="mr-auto text-xs text-muted">Gõ @ để nhắc tên ai đó</span>
      <span v-else-if="remaining <= 200" :class="['mr-auto text-xs', remaining < 0 ? 'text-danger' : 'text-muted']" aria-live="polite">
        Còn {{ remaining }} ký tự
      </span>
      <button type="button" class="btn-ghost" :disabled="busy" @click="emit('cancel')">Hủy</button>
      <button type="submit" class="btn-primary" :disabled="busy || !canSubmit">
        <ArrowPathIcon v-if="busy" class="h-4 w-4 animate-spin" aria-hidden="true" />
        {{ submitLabel }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { COMMENT_MAX, MENTION_SUGGESTIONS_QUERY } from '~/utils/api'
import type { UserRef } from '~/utils/api'
import { activeMention } from '~/utils/username'

const props = withDefaults(
  defineProps<{
    label: string
    placeholder?: string
    submitLabel?: string
    /** Nội dung ban đầu (khi sửa, hoặc "@handle " khi trả lời một trả lời). */
    initial?: string
    busy?: boolean
    error?: string
    autofocus?: boolean
    /** Luôn hiện nút (ô trả lời / sửa). Ô bình luận chính chỉ hiện nút khi đã gõ hoặc focus. */
    alwaysExpanded?: boolean
    /** Có thì bật gợi ý "@" (gợi ý ưu tiên người đã tham gia bình luận video này). */
    videoId?: string
  }>(),
  { placeholder: 'Viết bình luận…', submitLabel: 'Bình luận', initial: '', error: '', videoId: undefined },
)
const emit = defineEmits<{ submit: [body: string]; cancel: [] }>()

const { query } = useGraphql()
const id = useId()
const listId = `${id}-mentions`
const textarea = ref<HTMLTextAreaElement>()
const text = ref(props.initial)
const focused = ref(false)

const trimmed = computed(() => text.value.trim())
const remaining = computed(() => COMMENT_MAX - text.value.length)
const canSubmit = computed(() => trimmed.value.length > 0 && remaining.value >= 0 && trimmed.value !== props.initial.trim())
const expanded = computed(() => props.alwaysExpanded || focused.value || text.value.length > 0)

function submit() {
  if (!props.busy && canSubmit.value) emit('submit', trimmed.value)
}

// ---- Gợi ý nhắc tên ----
const mention = ref<{ start: number; query: string } | null>(null)
const suggestions = ref<UserRef[]>([])
const loadingSuggestions = ref(false)
const active = ref(-1)
const cache = new Map<string, UserRef[]>()
let fetchTimer: ReturnType<typeof setTimeout> | undefined
let fetchSeq = 0

const menuOpen = computed(() => focused.value && !!mention.value && !!props.videoId)

function updateMention() {
  const el = textarea.value
  if (!el || !props.videoId) return
  // Có bôi đen thì không gợi ý.
  const next = el.selectionStart === el.selectionEnd ? activeMention(text.value, el.selectionStart) : null
  if (next?.query === mention.value?.query && next?.start === mention.value?.start) return
  mention.value = next
  if (next) loadSuggestions(next.query.toLowerCase())
}

function loadSuggestions(term: string) {
  clearTimeout(fetchTimer)
  const seq = ++fetchSeq
  const cached = cache.get(term)
  if (cached) {
    suggestions.value = cached
    active.value = cached.length ? 0 : -1
    loadingSuggestions.value = false
    return
  }
  loadingSuggestions.value = true
  fetchTimer = setTimeout(async () => {
    try {
      const data = await query<{ mentionSuggestions: UserRef[] }>(MENTION_SUGGESTIONS_QUERY, { video_id: props.videoId, query: term })
      cache.set(term, data.mentionSuggestions)
      if (seq !== fetchSeq) return
      suggestions.value = data.mentionSuggestions
      active.value = data.mentionSuggestions.length ? 0 : -1
    } catch {
      if (seq === fetchSeq) suggestions.value = []
    } finally {
      if (seq === fetchSeq) loadingSuggestions.value = false
    }
  }, 150)
}

function closeMenu() {
  mention.value = null
  active.value = -1
}

/** Thay "@đang-gõ" bằng "@handle " và đặt con trỏ ngay sau. */
function pick(user: UserRef) {
  const el = textarea.value
  if (!el || !mention.value) return
  const caret = el.selectionStart
  const insert = `@${user.username} `
  text.value = text.value.slice(0, mention.value.start) + insert + text.value.slice(caret)
  const position = mention.value.start + insert.length
  closeMenu()
  nextTick(() => {
    el.focus()
    el.setSelectionRange(position, position)
  })
}

function onKeydown(event: KeyboardEvent) {
  if (menuOpen.value && !event.isComposing) {
    const count = suggestions.value.length
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault()
      active.value = (active.value + 1) % count
      return
    }
    if (event.key === 'ArrowUp' && count) {
      event.preventDefault()
      active.value = (active.value - 1 + count) % count
      return
    }
    if ((event.key === 'Enter' || event.key === 'Tab') && !event.ctrlKey && !event.metaKey && !event.shiftKey && active.value >= 0) {
      event.preventDefault()
      pick(suggestions.value[active.value])
      return
    }
    if (event.key === 'Escape') {
      // Esc lần đầu chỉ đóng gợi ý, không hủy cả ô nhập.
      event.preventDefault()
      closeMenu()
      return
    }
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    submit()
  } else if (event.key === 'Escape' && text.value.trim() === props.initial.trim()) {
    // Chỉ hủy bằng Esc khi chưa gõ gì thêm: lỡ tay nhấn Esc không được làm mất
    // nội dung đang viết (muốn bỏ thì bấm nút Hủy).
    emit('cancel')
  }
}

function onKeyup(event: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) updateMention()
}

function onBlur() {
  focused.value = false
  closeMenu()
}

/** Gọi sau khi gửi thành công. */
function reset() {
  text.value = ''
  closeMenu()
  textarea.value?.blur()
}

defineExpose({ reset, focus: () => textarea.value?.focus() })

onMounted(() => {
  if (props.autofocus) {
    textarea.value?.focus()
    // Đặt con trỏ cuối nội dung (khi sửa / trả lời có sẵn "@handle ").
    textarea.value?.setSelectionRange(text.value.length, text.value.length)
  }
})

onBeforeUnmount(() => clearTimeout(fetchTimer))
</script>

<style>
/* Ô nhập tự cao theo nội dung (trình duyệt chưa hỗ trợ thì giữ 1 dòng + cuộn). */
.comment-textarea {
  field-sizing: content;
  max-height: 16rem;
}
</style>
