import { USERNAME_AVAILABLE_QUERY } from '~/utils/api'
import { normalizeUsername, usernameFormatError } from '~/utils/username'

export interface UsernameStatus {
  state: 'idle' | 'checking' | 'ok' | 'error'
  message?: string
}

/**
 * Kiểm tra handle khi đang gõ: định dạng ngay ở client, trùng / giữ chỗ hỏi BE
 * (usernameAvailable, debounce + bỏ kết quả cũ). `current`: handle hiện tại của
 * mình (trang hồ sơ) thì không cần kiểm tra.
 */
export function useUsernameCheck(username: Ref<string>, current?: Ref<string | undefined>) {
  const { query } = useGraphql()
  const status = ref<UsernameStatus>({ state: 'idle' })
  let timer: ReturnType<typeof setTimeout> | undefined
  let sequence = 0

  // Theo dõi cả handle hiện tại: lưu xong (current = giá trị đang nhập) thì về trạng thái nghỉ.
  watch([username, () => current?.value], ([value]) => {
    clearTimeout(timer)
    const seq = ++sequence
    const normalized = normalizeUsername(value)

    if (!normalized || normalized === current?.value) {
      status.value = { state: 'idle' }
      return
    }
    const formatError = usernameFormatError(normalized)
    if (formatError) {
      status.value = { state: 'error', message: formatError }
      return
    }

    status.value = { state: 'checking' }
    timer = setTimeout(async () => {
      try {
        const data = await query<{ usernameAvailable: { available: boolean; message: string | null } }>(USERNAME_AVAILABLE_QUERY, {
          username: normalized,
        })
        if (seq !== sequence) return
        status.value = data.usernameAvailable.available
          ? { state: 'ok', message: `@${normalized} dùng được.` }
          : { state: 'error', message: data.usernameAvailable.message ?? 'Tên người dùng không dùng được.' }
      } catch {
        // Không kiểm tra được (mạng / rate limit): để BE báo khi lưu.
        if (seq === sequence) status.value = { state: 'idle' }
      }
    }, 400)
  })

  onBeforeUnmount(() => clearTimeout(timer))

  return status
}
