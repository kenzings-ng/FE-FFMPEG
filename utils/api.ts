/** Kiểu dữ liệu và GraphQL document khớp với graphql/{auth,user,video}/*.graphql của BE. */

export interface User {
  id: string
  name: string
  email: string
  /** null khi chưa xác thực email. */
  email_verified_at: string | null
  created_at: string
}

export type VideoStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'

export interface Video {
  id: string
  title: string
  is_public: boolean
  status: VideoStatus
  /**
   * Master playlist. Video lưu trên local: phát thẳng được (private: URL có chữ ký,
   * hết hạn sau 30 phút). Video trên CDN: phải kèm stream token, xem `stream`.
   */
  hls_url: string | null
  /** Ảnh bìa JPEG, giữ tỉ lệ gốc (video dọc thì ảnh dọc). null nếu chưa có. */
  poster_url: string | null
  /** Chỉ có trong VIDEO_QUERY, và chỉ với video READY trên CDN (R2). */
  stream?: VideoStream | null
  created_at: string
  user: { id: string; name: string }
}

/** Quyền phát video trên CDN: đổi `grant` lấy stream token tại `token_url`. */
export interface VideoStream {
  playlist_url: string
  token_url: string
  grant: string
  /** Unix timestamp (giây) grant hết hạn. */
  expires_at: number
}

export interface PaginatorInfo {
  currentPage: number
  lastPage: number
  total: number
  hasMorePages: boolean
}

const USER_FIELDS = 'id name email email_verified_at created_at'

const VIDEO_FIELDS = `
  id
  title
  is_public
  status
  hls_url
  poster_url
  created_at
  user { id name }
`

// ---- User / auth (cần đăng nhập) ----

export const ME_QUERY = `
  query Me {
    me { ${USER_FIELDS} }
  }
`

export const LOGOUT_MUTATION = `
  mutation Logout {
    logout
  }
`

export const UPDATE_PROFILE_MUTATION = `
  mutation UpdateProfile($name: String, $password: String) {
    updateProfile(name: $name, password: $password) { ${USER_FIELDS} }
  }
`

export const RESEND_VERIFICATION_MUTATION = `
  mutation ResendVerificationEmail {
    resendVerificationEmail
  }
`

// ---- Auth công khai (không cần đăng nhập) ----

export const FORGOT_PASSWORD_MUTATION = `
  mutation ForgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`

export const RESET_PASSWORD_MUTATION = `
  mutation ResetPassword($email: String!, $token: String!, $password: String!) {
    resetPassword(email: $email, token: $token, password: $password)
  }
`

// ---- Video ----

export const VIDEOS_QUERY = `
  query Videos($first: Int!, $page: Int) {
    videos(first: $first, page: $page) {
      data { ${VIDEO_FIELDS} }
      paginatorInfo { currentPage lastPage total hasMorePages }
    }
  }
`

const STREAM_FIELDS = 'stream { playlist_url token_url grant expires_at }'

export const VIDEO_QUERY = `
  query Video($id: ID!) {
    video(id: $id) { ${VIDEO_FIELDS} ${STREAM_FIELDS} }
  }
`

/** Grant mới cho player khi stream token sắp hết hạn / người xem đổi mạng. */
export const VIDEO_STREAM_QUERY = `
  query VideoStream($id: ID!) {
    video(id: $id) { id ${STREAM_FIELDS} }
  }
`

export const UPLOAD_VIDEO_MUTATION = `
  mutation UploadVideo($title: String!, $file: Upload!, $is_public: Boolean) {
    uploadVideo(title: $title, file: $file, is_public: $is_public) { ${VIDEO_FIELDS} }
  }
`

export const UPDATE_VIDEO_MUTATION = `
  mutation UpdateVideo($id: ID!, $title: String!) {
    updateVideo(id: $id, title: $title) { ${VIDEO_FIELDS} }
  }
`

export const SET_VISIBILITY_MUTATION = `
  mutation SetVideoVisibility($id: ID!, $is_public: Boolean!) {
    setVideoVisibility(id: $id, is_public: $is_public) { ${VIDEO_FIELDS} }
  }
`

export const SEGMENT_VIDEO_MUTATION = `
  mutation SegmentVideo($id: ID!) {
    segmentVideo(id: $id) { ${VIDEO_FIELDS} }
  }
`

export const DELETE_VIDEO_MUTATION = `
  mutation DeleteVideo($id: ID!) {
    deleteVideo(id: $id)
  }
`

// ---- Rule khớp với BE ----

/** name/title: không chứa < hoặc >, tối đa 255 ký tự. */
export const SAFE_TEXT_PATTERN = /^[^<>]*$/
export const TITLE_PATTERN = SAFE_TEXT_PATTERN
export const TITLE_MAX = 255
export const NAME_MAX = 255
export const PASSWORD_MIN = 8
/** BE: max:2097152 (KB) = 2 GB. */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
export const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

/** Video đang chờ / đang encode: còn cần polling để cập nhật. */
export function isInProgress(video: Pick<Video, 'status'>) {
  return video.status === 'PENDING' || video.status === 'PROCESSING'
}

export function formatBytes(bytes: number): string {
  // Khoảng trắng không ngắt (U+00A0) để số và đơn vị không bị xuống dòng.
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

/**
 * BE trả DateTime dạng "Y-m-d H:i:s" không kèm múi giờ, theo timezone của app
 * (config/app.php: Asia/Ho_Chi_Minh). Đổi hằng số này nếu BE đổi timezone.
 */
const SERVER_UTC_OFFSET = '+07:00'

export function parseServerDate(value: string): Date {
  return new Date(value.replace(' ', 'T') + SERVER_UTC_OFFSET)
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
const relativeFormatter = new Intl.RelativeTimeFormat('vi-VN', { numeric: 'auto' })

export function formatDate(value: string): string {
  return dateFormatter.format(parseServerDate(value))
}

/** "3 phút trước", "hôm qua"… ; quá 7 ngày thì hiện ngày cụ thể. */
export function formatRelative(value: string): string {
  const diffSec = (parseServerDate(value).getTime() - Date.now()) / 1000
  const abs = Math.abs(diffSec)
  if (abs < 60) return relativeFormatter.format(Math.round(diffSec), 'second')
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return relativeFormatter.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 7 * 86400) return relativeFormatter.format(Math.round(diffSec / 86400), 'day')
  return formatDate(value)
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}
