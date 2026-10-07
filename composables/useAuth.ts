import { GraphqlError, postGraphql } from '~/utils/graphql'
import type { User } from '~/utils/api'

/**
 * Đăng nhập qua mutation `register` / `login` / `refreshToken` của GraphQL (BE gọi Passport
 * nội bộ, không mở route /oauth/token).
 *
 * - remember_me=true: refresh token sống 30 ngày; FE lưu token ở localStorage để
 *   giữ phiên qua lần mở trình duyệt sau. Khi refresh phải gửi lại remember_me,
 *   nếu không BE sẽ cấp phiên ngắn (hoặc từ chối với invalid_scope).
 * - Không remember: refresh token 1 ngày, FE lưu ở sessionStorage (đóng tab là mất).
 *
 * Access token chỉ sống 1 giờ, nên mọi request đi qua getAccessToken() để tự
 * refresh trước khi hết hạn.
 */

interface StoredSession {
  accessToken: string
  refreshToken: string
  /** Unix ms */
  expiresAt: number
  remember: boolean
}

interface AuthPayload {
  access_token: string
  refresh_token: string
  expires_in: number
}

const AUTH_FIELDS = 'access_token refresh_token expires_in'

const LOGIN_MUTATION = `
  mutation Login($email: String!, $password: String!, $remember_me: Boolean) {
    login(email: $email, password: $password, remember_me: $remember_me) { ${AUTH_FIELDS} }
  }
`

const REGISTER_MUTATION = `
  mutation Register($name: String!, $username: String, $email: String!, $password: String!, $remember_me: Boolean) {
    register(name: $name, username: $username, email: $email, password: $password, remember_me: $remember_me) { ${AUTH_FIELDS} }
  }
`

const REFRESH_MUTATION = `
  mutation RefreshToken($refresh_token: String!, $remember_me: Boolean) {
    refreshToken(refresh_token: $refresh_token, remember_me: $remember_me) { ${AUTH_FIELDS} }
  }
`

export type AuthUser = User

const STORAGE_KEY = 'ffmpeg-stream.session'
// Refresh sớm hơn hạn thật một chút để tránh request bị từ chối giữa chừng.
const EXPIRY_SKEW_MS = 60_000

export class AuthError extends Error {}

function readStored(): StoredSession | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as StoredSession
    } catch {
      // Storage bị chặn hoặc dữ liệu hỏng: coi như chưa đăng nhập.
    }
  }
  return null
}

function writeStored(session: StoredSession | null) {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      storage.removeItem(STORAGE_KEY)
    } catch {}
  }
  if (!session) return
  try {
    ;(session.remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {}
}

let refreshInFlight: Promise<void> | null = null

export function useAuth() {
  const config = useRuntimeConfig()
  const session = useState<StoredSession | null>('auth.session', () => (import.meta.client ? readStored() : null))
  const user = useState<AuthUser | null>('auth.user', () => null)

  const isLoggedIn = computed(() => session.value !== null)

  function setSession(next: StoredSession | null) {
    session.value = next
    writeStored(next)
    if (!next) user.value = null
  }

  /**
   * Gọi thẳng /graphql (không qua useGraphql, vì useGraphql lại phụ thuộc
   * useAuth để gắn token). Các mutation này không cần Authorization.
   */
  async function requestToken<F extends 'register' | 'login' | 'refreshToken'>(
    field: F,
    document: string,
    variables: Record<string, unknown>,
    remember: boolean,
  ) {
    const data = await postGraphql<Record<F, AuthPayload>>(`${config.public.apiBase}/graphql`, document, variables)
    const payload = data[field]
    setSession({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + payload.expires_in * 1000,
      remember,
    })
  }

  async function login(email: string, password: string, remember: boolean) {
    try {
      await requestToken('login', LOGIN_MUTATION, { email, password, remember_me: remember }, remember)
    } catch (error) {
      // Sai mật khẩu: PassportTokenIssuer trả lỗi validation "credentials".
      if (error instanceof GraphqlError && error.field('credentials')) throw new AuthError('Email hoặc mật khẩu không đúng.')
      throw error
    }
  }

  /** Đăng ký xong BE trả token luôn (đã đăng nhập). Lỗi validate từng field nằm trong GraphqlError. */
  /** username rỗng: BE tự sinh từ tên. */
  async function register(name: string, username: string, email: string, password: string, remember: boolean) {
    await requestToken('register', REGISTER_MUTATION, { name, username: username || null, email, password, remember_me: remember }, remember)
  }

  async function refresh() {
    const current = session.value
    if (!current) throw new AuthError('Phiên đăng nhập đã hết hạn.')

    refreshInFlight ??= requestToken(
      'refreshToken',
      REFRESH_MUTATION,
      { refresh_token: current.refreshToken, remember_me: current.remember },
      current.remember,
    )
      .catch((error) => {
        // Chỉ xóa phiên khi BE từ chối refresh token; lỗi mạng / rate limit thì giữ để thử lại sau.
        if (error instanceof GraphqlError && error.field('credentials')) {
          setSession(null)
          throw new AuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
        }
        throw error
      })
      .finally(() => {
        refreshInFlight = null
      })

    await refreshInFlight
  }

  async function getAccessToken(): Promise<string | null> {
    if (!session.value) return null
    if (Date.now() >= session.value.expiresAt - EXPIRY_SKEW_MS) await refresh()
    return session.value?.accessToken ?? null
  }

  /** Xóa phiên phía client mà không gọi BE (khi token đã không còn hợp lệ). */
  function clear() {
    setSession(null)
  }

  return { session, user, isLoggedIn, login, register, refresh, getAccessToken, clear, setUser: (u: AuthUser | null) => (user.value = u) }
}
