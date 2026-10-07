import type { UserRef } from '~/utils/api'

/**
 * Handle (@username) — PHẢI khớp BE: app/Support/Username.php.
 * 3–30 ký tự a-z 0-9 . _ ; bắt đầu / kết thúc bằng chữ hoặc số; không có "..".
 */
export const USERNAME_MIN = 3
export const USERNAME_MAX = 30
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

/** Lỗi định dạng (kiểm tra nhanh ở client); trùng / giữ chỗ thì hỏi BE (usernameAvailable). */
export function usernameFormatError(value: string): string | undefined {
  const username = normalizeUsername(value)
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Tên người dùng phải dài ${USERNAME_MIN}–${USERNAME_MAX} ký tự.`
  }
  if (!USERNAME_PATTERN.test(username) || username.includes('..')) {
    return 'Chỉ dùng chữ thường không dấu, số, dấu chấm và gạch dưới; bắt đầu và kết thúc bằng chữ hoặc số.'
  }
  return undefined
}

/** Bỏ dấu tiếng Việt (kể cả đ/Đ). */
export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
}

/** Gợi ý handle từ tên hiển thị, vd. "Bảo Nguyễn" → "baonguyen" (BE sẽ báo nếu đã có người dùng). */
export function suggestUsername(name: string): string {
  const base = stripDiacritics(name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
  return base.length >= USERNAME_MIN ? base : base ? `user${base}` : ''
}

// Không dùng lookbehind (?<!…): Safari < 16.4 không hỗ trợ, regex lỗi là hỏng cả module.
// Ký tự liền trước '@' không được là chữ / số / . _ @ (để không khớp email a@b.com).
const MENTION = /(^|[^A-Za-z0-9._@])@([A-Za-z0-9](?:[A-Za-z0-9._]*[A-Za-z0-9])?)/g

export interface TextSegment {
  text: string
  /** Người được nhắc nếu đoạn này là một lần nhắc tên (text đã là "@handle hiện tại"). */
  user?: UserRef
}

/**
 * Tách nội dung bình luận thành đoạn chữ và đoạn nhắc tên. `mentions` (từ BE)
 * map chữ "@handle" lúc viết sang người được nhắc; đoạn nhắc tên hiển thị handle
 * HIỆN TẠI của người đó, nên họ đổi handle thì bình luận cũ vẫn đúng người.
 */
export function splitMentions(text: string, mentions: { handle: string; user: UserRef }[]): TextSegment[] {
  const byHandle = new Map(mentions.map((m) => [m.handle.toLowerCase(), m.user]))
  const segments: TextSegment[] = []
  let last = 0
  for (const match of text.matchAll(MENTION)) {
    const user = byHandle.get(match[2].toLowerCase())
    if (!user) continue
    const start = match.index! + match[1].length
    if (start > last) segments.push({ text: text.slice(last, start) })
    segments.push({ text: `@${user.username}`, user })
    last = start + 1 + match[2].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}

/** Nội dung với mọi lần nhắc tên đổi sang handle hiện tại (dùng khi mở ô sửa). */
export function withCurrentHandles(text: string, mentions: { handle: string; user: UserRef }[]): string {
  return splitMentions(text, mentions)
    .map((segment) => segment.text)
    .join('')
}

/** "@…" đang gõ ngay trước con trỏ (để mở gợi ý), hoặc null. */
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|[^A-Za-z0-9._@])@([A-Za-z0-9._]{0,30})$/.exec(text.slice(0, caret))
  if (!match) return null
  return { start: caret - match[2].length - 1, query: match[2] }
}
