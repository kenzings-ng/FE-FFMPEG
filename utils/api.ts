/** Kiểu dữ liệu và GraphQL document khớp với graphql/{auth,user,video}/*.graphql của BE. */

export interface User {
  id: string
  name: string
  /** Handle duy nhất, không có '@'. */
  username: string
  /** Phần giới thiệu trên trang kênh. */
  bio: string | null
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
  user: UserRef
}

/** Người dùng rút gọn hiển thị kèm nội dung (video, bình luận). */
export interface UserRef {
  id: string
  name: string
  username: string
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

const USER_FIELDS = 'id name username bio email email_verified_at created_at'

const VIDEO_FIELDS = `
  id
  title
  is_public
  status
  hls_url
  poster_url
  created_at
  user { id name username }
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
  mutation UpdateProfile($name: String, $username: String, $bio: String, $current_password: String, $password: String) {
    updateProfile(name: $name, username: $username, bio: $bio, current_password: $current_password, password: $password) { ${USER_FIELDS} }
  }
`

/** Kiểm tra handle khi đang gõ (không cần đăng nhập). */
export const USERNAME_AVAILABLE_QUERY = `
  query UsernameAvailable($username: String!) {
    usernameAvailable(username: $username) { username available message }
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

// ---- Trang kênh /@handle ----

export interface Channel extends UserRef {
  bio: string | null
  /** Số video công khai đã xử lý xong. */
  videos_count: number
  created_at: string
}

/** Thông tin kênh (handle cũ vừa đổi vẫn trả về đúng người: so channel.username để chuyển URL). */
export const CHANNEL_QUERY = `
  query Channel($username: String!) {
    userByUsername(username: $username) { id name username bio videos_count created_at }
  }
`

/** Tab Video của kênh: chỉ video công khai đã xử lý xong, mới nhất trước. */
export const CHANNEL_VIDEOS_QUERY = `
  query ChannelVideos($username: String!, $first: Int!, $page: Int) {
    userByUsername(username: $username) {
      id
      videos(first: $first, page: $page) {
        data { ${VIDEO_FIELDS} }
        paginatorInfo { currentPage hasMorePages total }
      }
    }
  }
`

/** Link tới trang kênh. */
export function channelPath(username: string): string {
  return `/@${username}`
}

// ---- Bình luận (graphql/comment/comment.graphql) ----

export interface Comment {
  id: string
  /** Text thuần: luôn hiển thị bằng interpolation, KHÔNG dùng v-html. */
  body: string
  user: UserRef
  /** Người được trả lời (khi trả lời một trả lời). Nội dung đã có sẵn "@handle" của họ. */
  reply_to_user: UserRef | null
  /**
   * Lần nhắc tên có thật: `handle` là chữ lúc viết (trong body), `user` là người
   * được nhắc với handle hiện tại. Hiển thị luôn dùng handle hiện tại.
   */
  mentions: { handle: string; user: UserRef }[]
  /** null = bình luận gốc. */
  parent_id: string | null
  replies_count: number
  edited_at: string | null
  created_at: string
}

export interface Page<T> {
  data: T[]
  paginatorInfo: { currentPage: number; hasMorePages: boolean; total: number }
}

export const COMMENT_PAGE_SIZE = 20

const COMMENT_FIELDS = `
  id
  body
  user { id name username }
  reply_to_user { id name username }
  mentions { handle user { id name username } }
  parent_id
  replies_count
  edited_at
  created_at
`

/** Bình luận gốc của video, mới nhất trước. */
export const VIDEO_COMMENTS_QUERY = `
  query VideoComments($id: ID!, $first: Int!, $page: Int) {
    video(id: $id) {
      id
      comments_count
      comments(first: $first, page: $page) {
        data { ${COMMENT_FIELDS} }
        paginatorInfo { currentPage hasMorePages total }
      }
    }
  }
`

/** Trả lời của một bình luận gốc, cũ nhất trước. */
export const COMMENT_REPLIES_QUERY = `
  query CommentReplies($id: ID!, $first: Int!, $page: Int) {
    comment(id: $id) {
      id
      replies(first: $first, page: $page) {
        data { ${COMMENT_FIELDS} }
        paginatorInfo { currentPage hasMorePages total }
      }
    }
  }
`

export const CREATE_COMMENT_MUTATION = `
  mutation CreateComment($video_id: ID!, $body: String!, $reply_to_id: ID) {
    createComment(video_id: $video_id, body: $body, reply_to_id: $reply_to_id) { ${COMMENT_FIELDS} }
  }
`

export const UPDATE_COMMENT_MUTATION = `
  mutation UpdateComment($id: ID!, $body: String!) {
    updateComment(id: $id, body: $body) { ${COMMENT_FIELDS} }
  }
`

/** Gợi ý khi gõ "@" trong bình luận của video. */
export const MENTION_SUGGESTIONS_QUERY = `
  query MentionSuggestions($video_id: ID!, $query: String) {
    mentionSuggestions(video_id: $video_id, query: $query) { id name username }
  }
`

export const DELETE_COMMENT_MUTATION = `
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`

// ---- Rule khớp với BE ----

/** name/title: không chứa < hoặc >, tối đa 255 ký tự. */
export const SAFE_TEXT_PATTERN = /^[^<>]*$/
export const TITLE_PATTERN = SAFE_TEXT_PATTERN
export const TITLE_MAX = 255
export const NAME_MAX = 255
export const PASSWORD_MIN = 8
/** BE: comment body max:2000. */
export const COMMENT_MAX = 2000
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
