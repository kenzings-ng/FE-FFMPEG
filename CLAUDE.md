# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Frontend Nuxt 3 (SPA, `ssr: false`) + Tailwind cho app upload / phát video HLS. Backend Laravel + GraphQL nằm ở repo riêng `FFmpeg`. Comment và text giao diện viết bằng **tiếng Việt**: giữ nguyên quy ước này.

## Lệnh thường dùng

```shell
cp .env.example .env          # đặt NUXT_PUBLIC_API_BASE=https://api.example.com (domain Laravel)
npm install
npm run dev                   # http://localhost:3000

# Typecheck. `npm run typecheck` (nuxi) kéo vue-tsc 3, không chạy được với setup này. Dùng bản 2:
npx -p vue-tsc@2 -p typescript@5 vue-tsc --noEmit

npm run build                 # build vào .output (không ảnh hưởng bản pm2 đang chạy)
npm run deploy                # build → copy sang .output-pm2 → pm2 reload (ecosystem.config.cjs)
npm run generate              # bản tĩnh cho GitHub Pages (workflow .github/workflows/nuxtjs.yml)
```

Repo không có test hay lint.

- `NUXT_PUBLIC_API_BASE` được đọc lúc **runtime**: pm2 nạp `.env` qua `ecosystem.config.cjs`, nên đổi giá trị chỉ cần `pm2 reload ecosystem.config.cjs --update-env`.
- Bản GitHub Pages lấy biến này từ Actions Variables, và chạy dưới `NUXT_APP_BASE_URL=/<repo>/`. Vì vậy link tĩnh trong `<head>` (favicon…) phải tự ghép `baseURL` trong `nuxt.config.ts`.

## Cấu trúc source

Luồng chính: **page** (`pages/`) → **composable** (`composables/`) → **transport** (`utils/graphql.ts`) → BE `/graphql`. Riêng dữ liệu video (playlist, segment, khóa, ảnh bìa) được tải thẳng từ CDN (Cloudflare Worker), không đi qua BE.

### Khung app
```
app.vue                     # NuxtLoadingIndicator + NuxtLayout/NuxtPage + OfflineScreen
error.vue                   # trang lỗi toàn cục (404, lỗi JS, createError)
layouts/
├── default.vue             # app đã đăng nhập: AppHeader + VerifyEmailBanner + nội dung
└── auth.vue                # các trang đăng nhập / đăng ký / quên & đặt lại mật khẩu
middleware/auth.global.ts   # chặn trang cần đăng nhập → /login?redirect=…; khách vào trang auth khi đã đăng nhập → /
nuxt.config.ts              # ssr: false, runtimeConfig.public.apiBase, <head> (font, favicon có ghép baseURL)
ecosystem.config.cjs        # pm2 chạy .output-pm2, nạp biến từ .env
```

### Trang (`pages/`)
```
index.vue                   # thư viện video: lưới VideoCard, lọc ?filter=mine, phân trang, polling khi có video đang xử lý
upload.vue                  # chọn file + tiêu đề + public/private, upload có tiến độ, cảnh báo khi rời trang giữa chừng
@[username].vue             # trang kênh /@handle: đầu kênh, tab Video (công khai) / Giới thiệu (?tab=about);
                            #   handle cũ hoặc gõ hoa → router.replace sang URL chuẩn
videos/[id].vue             # xem video (VideoPlayer) + quản lý của chủ: đổi tên, public/private, xử lý lại, xóa;
                            #   polling khi đang xử lý; refreshStream() lấy grant mới cho player
profile.vue                 # xem email, gửi lại email xác thực, đổi tên + handle + giới thiệu, đổi mật khẩu
                            #   (cần mật khẩu hiện tại), đăng xuất
login.vue / register.vue    # đăng nhập (remember me), đăng ký (handle tự gợi ý từ tên, báo trùng khi gõ;
                            #   BE tự đăng nhập + gửi email xác thực)
forgot-password.vue         # gửi email đặt lại mật khẩu (luôn báo chung chung, chống dò email)
reset-password.vue          # mở từ link email: ?token=&email= → mutation resetPassword
email-verified.vue          # BE redirect về sau khi bấm link xác thực: ?status=ok|invalid
```

### Component (`components/`)
```
video/
├── VideoPlayer.vue         # hls.js + Plyr; stream token: đổi grant, gia hạn, xin lại khi 403; Safari native
├── VideoCard.vue           # thẻ trong thư viện: ảnh bìa (nền mờ + ảnh contain), badge trạng thái / quyền
└── StatusBadge.vue         # badge PENDING / PROCESSING / FAILED / public / private
comment/
├── CommentSection.vue      # khối bình luận dưới video: tổng số, ô viết, bình luận gốc (mới nhất trước), tải thêm
├── CommentThread.vue       # 1 bình luận gốc + trả lời: "N phản hồi" tải khi bấm, ô trả lời, cập nhật số đếm
├── CommentItem.vue         # 1 bình luận: avatar, @Tên, (đã chỉnh sửa), Phản hồi / Sửa / Xóa (quyền khớp CommentPolicy)
└── CommentComposer.vue     # ô nhập tự giãn, đếm ký tự (≤ 2000), Ctrl/Cmd+Enter gửi; gợi ý "@" (combobox ARIA)
form/
├── TextField.vue / PasswordField.vue   # input có label + lỗi theo field (dùng với useFormErrors)
└── Alert.vue               # lỗi chung của form
AppHeader.vue / AppLogo.vue # thanh trên: logo, nút Tải lên, menu tài khoản (Kênh của bạn, Tài khoản)
UserAvatar.vue              # avatar chữ cái đầu, màu theo id (chưa có ảnh đại diện)
VerifyEmailBanner.vue       # nhắc xác thực email (không bắt buộc), ẩn trong phiên tab
ConfirmDialog.vue           # hộp xác nhận thao tác nguy hiểm (mặc định focus nút Hủy)
StateMessage.vue            # khối trạng thái rỗng / lỗi (title, description, icon, tone)
OfflineScreen.vue           # phủ màn hình khi mất mạng, nút Thử lại gọi BE
```

### Logic dùng chung
```
composables/
├── useAuth.ts              # phiên đăng nhập (token): login / register / refresh / clear, lưu local- hoặc
│                           #   sessionStorage, getAccessToken() tự refresh; giữ state user
├── useGraphql.ts           # query() có Bearer + refresh-một-lần khi Unauthenticated; upload() multipart có tiến độ
├── useAccount.ts           # tài khoản qua GraphQL: loadUser (me), updateProfile, resendVerificationEmail,
│                           #   logout (revoke ở BE; lỗi mạng vẫn xóa phiên ở client)
├── useUsernameCheck.ts     # kiểm tra handle khi gõ: định dạng ở client, trùng / giữ chỗ hỏi BE (debounce)
├── useFormErrors.ts        # gắn lỗi validation của Lighthouse vào đúng field + lỗi chung
├── usePolling.ts           # gọi định kỳ, tạm dừng khi tab ẩn (BE giới hạn 60 req/phút)
└── useNetworkStatus.ts     # online / offline dùng chung toàn app
utils/
├── api.ts                  # type + GraphQL document + rule validate, KHỚP với schema BE; formatBytes, formatRelative…
├── graphql.ts              # postGraphql() + GraphqlError (validation, field(), isUnauthenticated, isForbidden…)
├── username.ts             # quy tắc handle (KHỚP BE app/Support/Username.php), gợi ý handle từ tên,
│                           #   splitMentions() để tô màu, activeMention() tìm "@…" trước con trỏ
└── navigation.ts           # safeRedirect(): chỉ cho ?redirect= là đường dẫn nội bộ (chống open redirect)
assets/css/tailwind.css     # token màu light (:root) / dark (.dark) + class dùng chung (btn-primary, card…)
public/                     # favicon.svg / favicon.ico / apple-touch-icon.png
```

## Kiến trúc

### Gọi API
Mọi request đều đi tới `${apiBase}/graphql`, không dùng REST.
- `utils/api.ts`: interface TypeScript, GraphQL document (`VIDEO_FIELDS`, `VIDEO_QUERY`…) và các rule validate. File này **phải khớp với schema `graphql/**` của BE**: thêm hay đổi field ở BE thì sửa ở đây.
- `utils/graphql.ts`: lớp gửi request thấp nhất. `GraphqlError` có `validation` và `field(name)` (lỗi validate theo argument), `isUnauthenticated`, `isForbidden`, `isRateLimited`.
- `composables/useGraphql.ts`: `query()` tự gắn Bearer token, gặp `Unauthenticated` thì refresh rồi thử lại đúng một lần. `upload()` dùng XHR theo GraphQL multipart spec để có tiến độ upload.
- `composables/useAuth.ts`: đăng nhập, đăng ký và refresh qua mutation của BE (không gọi `/oauth/token`).
  - Có remember me: lưu token ở `localStorage`, refresh token sống 30 ngày.
  - Không có: lưu ở `sessionStorage`, 1 ngày.
  - Access token sống 1 giờ. `getAccessToken()` tự refresh trước khi hết hạn, và chỉ có một lần refresh chạy tại một thời điểm.
  - Khi refresh **phải gửi lại `remember_me`**.
- `middleware/auth.global.ts`: mọi trang đều cần đăng nhập, trừ các trang auth (danh sách trong middleware).
- BE giới hạn 60 request/phút cho `/graphql`. Danh sách và trang chi tiết video dùng `usePolling` để theo dõi video đang xử lý; hàm này dừng khi tab bị ẩn.

### Player (`components/video/VideoPlayer.vue`)
hls.js kết hợp Plyr. Có hai chế độ:
- **Video lưu trên CDN (R2)**, khi `video.stream` có giá trị:
  - Đổi `stream.grant` lấy stream token tại `stream.token_url` (Worker).
  - `xhrSetup` (async) gắn `?token=` mới nhất vào mọi request: playlist, segment và khóa `{keyId}.key`.
  - `shouldRetry` trong các `*LoadPolicy` cho phép thử lại khi gặp 403. hls.js mặc định không retry lỗi 4xx; ở đây player xin token mới rồi tải lại đúng request đó. Nhờ vậy đổi Wi-Fi/4G không làm video dừng, vì token gắn với dải IP.
  - Token được gia hạn trước khi hết hạn 2 phút. Grant mới lấy qua prop `refreshStream`, tức query `VIDEO_STREAM_QUERY`.
  - Safari native HLS không tự gia hạn token được, nên xin token hạn dài (`native=1`).
- **Video lưu trên local** (định dạng cũ): phát thẳng `hls_url`. URL có chữ ký nếu video private.
- Plyr đặt `storage: { enabled: false }`. Nếu bật lại, Plyr sẽ nhớ trạng thái tắt tiếng và mọi video sau mở ra đều không có tiếng.
- Plyr thay `<video>` bằng một bản clone khi destroy, nên đổi nguồn phát thì component cha phải remount (`:key="video.hls_url"`).

### Bình luận (`components/comment/`)
- Chỉ 2 tầng (BE gắn mọi trả lời vào bình luận gốc). Bình luận gốc phân trang 20/lần, trả lời chỉ tải khi bấm "N phản hồi".
- Sau khi gửi, sửa hoặc xóa, component tự cập nhật danh sách và số đếm tại chỗ, không tải lại cả trang. Khi tải trang tiếp theo thì bỏ các phần tử trùng id, vì bình luận mới đẩy phần tử cũ sang trang sau.
- **Nhắc tên:** gõ `@` mở gợi ý (`mentionSuggestions`, debounce + cache theo từ khóa). Chọn bằng ↑/↓ + Enter/Tab. Esc lần đầu chỉ đóng gợi ý. Khi ô đã có nội dung thì Esc không hủy, để lỡ tay không mất bài đang viết.
- `comment.mentions` = `{ handle lúc viết, user }`. `splitMentions()` thay "@handle lúc viết" bằng `@{user.username}` hiện tại và link tới kênh. Ô sửa mở bằng `withCurrentHandles()`. Trả lời một trả lời thì ô nhập điền sẵn `@handle `.
- Tên, avatar, `@handle` người dùng ở mọi nơi đều link tới kênh qua `channelPath()` (`utils/api.ts`). Trong `VideoCard`, link phải có `relative z-10` để nổi trên lớp link phủ cả thẻ.
- Regex trong `utils/username.ts` **không dùng lookbehind**, vì Safari < 16.4 báo lỗi cú pháp và làm hỏng cả module.
- Nội dung **chỉ render bằng interpolation** + `whitespace-pre-line` (cho phép `<` `>`). Không dùng `v-html`.

### Ảnh bìa
`poster_url` do BE trả về là URL có chữ ký và hạn dùng 1–2 giờ, không lưu lâu dài được. `VideoCard` hiển thị một lớp nền mờ phía sau và ảnh thật dạng `object-contain` ở trên, để video dọc không bị cắt.

### Giao diện
- Màu dùng token CSS dạng `"R G B"` trong `assets/css/tailwind.css` (`:root` cho light, `.dark` cho dark), được map trong `tailwind.config.js`, nên dùng được dạng `bg-accent/20`. Dùng class token (`bg-surface`, `text-muted`, `border-line`, `bg-accent`…), không viết mã màu cứng.
- `@nuxtjs/color-mode` mặc định dark (`classSuffix: ''`).
- Layout: `default` cho app, `auth` cho các trang login, đăng ký, quên mật khẩu (`definePageMeta({ layout: 'auth' })`).

## Quy ước repo
- File được commit (`.env.example`, README…) chỉ dùng giá trị giả như `example.com`. Domain thật chỉ nằm trong `.env` (gitignored).
