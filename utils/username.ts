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
  /** Người được nhắc nếu đoạn này là một lần nhắc tên (text là "@Tên người dùng" hoặc "@handle"). */
  user?: UserRef
}

/**
 * Tách nội dung bình luận thành đoạn chữ và đoạn nhắc tên. Hỗ trợ cả @handle
 * lẫn @Tên người dùng (kiểu Facebook).
 */
export function splitMentions(text: string, mentions: { handle: string; user: UserRef }[]): TextSegment[] {
  if (!mentions || !mentions.length || !text) return [{ text: text || '' }]

  // Tạo danh sách các chuỗi nhắc tên cần tìm kiếm, ưu tiên chuỗi dài nhất trước
  const targets: { search: string; user: UserRef }[] = []
  for (const m of mentions) {
    if (m.handle) targets.push({ search: `@${m.handle}`, user: m.user })
    if (m.user?.name && m.user.name !== m.handle) targets.push({ search: `@${m.user.name}`, user: m.user })
    if (m.user?.username && m.user.username !== m.handle) targets.push({ search: `@${m.user.username}`, user: m.user })
  }
  targets.sort((a, b) => b.search.length - a.search.length)

  // Tìm tất cả các vị trí xuất hiện không đè lên nhau
  const matches: { start: number; end: number; displayText: string; user: UserRef }[] = []
  const lowerText = text.toLowerCase()

  for (const target of targets) {
    const searchLower = target.search.toLowerCase()
    let pos = 0
    while ((pos = lowerText.indexOf(searchLower, pos)) !== -1) {
      const end = pos + target.search.length
      // Kiểm tra xem vị trí này đã bị match trước đó chưa (overlap)
      const overlaps = matches.some((m) => Math.max(m.start, pos) < Math.min(m.end, end))
      if (!overlaps) {
        // Ký tự liền trước '@' phải là đầu chuỗi hoặc khoảng trắng/dấu mở ngoặc
        const validStart = pos === 0 || /[\s(]/.test(text[pos - 1])
        // Ký tự liền sau phải là hết chuỗi hoặc khoảng trắng/dấu câu
        const validEnd = end === text.length || /[\s,;:!?.)<>]/.test(text[end])
        if (validStart && validEnd) {
          matches.push({
            start: pos,
            end,
            displayText: text.slice(pos, end),
            user: target.user,
          })
        }
      }
      pos = end
    }
  }

  if (!matches.length) return [{ text }]

  matches.sort((a, b) => a.start - b.start)

  const segments: TextSegment[] = []
  let last = 0
  for (const m of matches) {
    if (m.start > last) {
      segments.push({ text: text.slice(last, m.start) })
    }
    segments.push({ text: m.displayText, user: m.user })
    last = m.end
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last) })
  }

  return segments
}

/** Nội dung khi mở ô sửa: giữ nguyên nội dung gốc để người dùng sửa. */
export function withCurrentHandles(text: string, _mentions: { handle: string; user: UserRef }[]): string {
  return text
}

/** "@…" đang gõ ngay trước con trỏ (hỗ trợ cả tiếng Việt có dấu, khoảng trắng trong tên), hoặc null. */
export function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const beforeCaret = text.slice(0, caret)
  const atIndex = beforeCaret.lastIndexOf('@')
  if (atIndex === -1) return null
  // Ký tự liền trước '@' phải là đầu dòng, khoảng trắng hoặc dấu mở ngoặc
  if (atIndex > 0 && !/[\s(]/.test(beforeCaret[atIndex - 1])) return null
  const query = beforeCaret.slice(atIndex + 1)
  // Không cho chứa xuống dòng, ký tự ngắt câu hoặc quá 35 ký tự
  if (/[\n\r\t.,!?;:<>]/.test(query) || query.length > 35) return null
  return { start: atIndex, query }
}
