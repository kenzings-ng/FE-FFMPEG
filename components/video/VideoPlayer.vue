<template>
  <div class="video-player aspect-video overflow-hidden rounded-xl bg-black">
    <video ref="videoEl" class="h-full w-full" playsinline controls :poster="poster ?? undefined" :aria-label="title" />
  </div>
</template>

<script setup lang="ts">
import 'plyr/dist/plyr.css'
import type Hls from 'hls.js'
import type { HlsConfig, LoadPolicy } from 'hls.js'
import type Plyr from 'plyr'
import type { VideoStream } from '~/utils/api'

const props = defineProps<{
  src: string
  title: string
  /** Ảnh bìa hiện trước khi bấm phát. */
  poster?: string | null
  /**
   * Video trên CDN (R2): mọi request playlist / segment / khóa phải kèm stream token.
   * Không truyền = video lưu trên local, phát thẳng `src`.
   */
  stream?: VideoStream | null
  /** Lấy grant mới (query lại field `stream`) khi grant hiện tại đã hết hạn. */
  refreshStream?: () => Promise<VideoStream | null>
}>()
const emit = defineEmits<{
  /** Lỗi không phục hồi được. `expired`: link ký / token đã hết hạn (403), nên lấy hls_url mới. */
  error: [reason: 'expired' | 'network' | 'media' | 'unsupported']
}>()

const videoEl = ref<HTMLVideoElement>()
let hls: Hls | null = null
let player: Plyr | null = null
let disposed = false

// Plyr mặc định lưu âm lượng / tắt tiếng vào localStorage ('plyr') và áp lại
// cho mọi video sau: lỡ tắt tiếng một lần là video nào cũng câm. Tắt hẳn để
// video luôn mở với âm thanh bật, âm lượng tối đa.
const PLYR_BASE = { storage: { enabled: false }, muted: false, volume: 1 }

const PLYR_I18N = {
  play: 'Phát',
  pause: 'Tạm dừng',
  mute: 'Tắt tiếng',
  unmute: 'Bật tiếng',
  enterFullscreen: 'Toàn màn hình',
  exitFullscreen: 'Thoát toàn màn hình',
  settings: 'Cài đặt',
  quality: 'Chất lượng',
  speed: 'Tốc độ',
  normal: 'Bình thường',
  qualityLabel: { 0: 'Tự động' },
}

// ---- Stream token (chỉ với video trên CDN) ----
//
// Token do Worker cấp, gắn với dải IP của người xem và hết hạn sau ~15 phút.
// Player tự gia hạn trước khi hết hạn; khi người xem đổi mạng (Wi-Fi <-> 4G)
// thì request kế tiếp bị 403, player xin token mới rồi tải lại đúng request
// đó, trong lúc vẫn phát tiếp từ buffer nên người xem không thấy gián đoạn.

/** Gia hạn khi token còn chừng này giây. */
const RENEW_BEFORE_SEC = 120
/** Số lần xin token mới liên tiếp cho cùng một request bị 403. */
const MAX_AUTH_RETRIES = 3

let grant: VideoStream | null = props.stream ?? null
let token = ''
let renewTimer: ReturnType<typeof setTimeout> | undefined
let renewing: Promise<boolean> | null = null

const nowSec = () => Math.floor(Date.now() / 1000)

/** Đổi grant lấy stream token. Grant hết hạn (hoặc dùng không được) thì xin grant mới một lần. */
function renewToken(native = false): Promise<boolean> {
  renewing ??= (async () => {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!grant || grant.expires_at - nowSec() < 10 || attempt > 0) {
          grant = (await props.refreshStream?.()) ?? null
        }
        if (!grant || disposed) return false

        const url = new URL(grant.token_url)
        url.searchParams.set('grant', grant.grant)
        if (native) url.searchParams.set('native', '1')

        const res = await fetch(url, { cache: 'no-store' })
        if (res.ok) {
          const body: { token: string; expires_at: number } = await res.json()
          token = body.token
          scheduleRenew(body.expires_at, native)
          return true
        }
        if (res.status !== 403) return false
      }
      return false
    } catch {
      return false
    } finally {
      renewing = null
    }
  })()
  return renewing
}

function scheduleRenew(expiresAt: number, native: boolean) {
  clearTimeout(renewTimer)
  // Safari native không đổi được token của playlist đã nạp; xử lý ở sự kiện 'error'.
  if (native || disposed) return
  renewTimer = setTimeout(() => void renewToken(), Math.max(5, expiresAt - nowSec() - RENEW_BEFORE_SEC) * 1000)
}

function withToken(url: string): string {
  const parsed = new URL(url, window.location.href)
  parsed.searchParams.set('token', token)
  return parsed.toString()
}

/** Cho phép thử lại request bị 403 sau khi xin token mới (hls.js mặc định không retry lỗi 4xx). */
function withAuthRetry(policy: LoadPolicy): LoadPolicy {
  const errorRetry = policy.default.errorRetry ?? { maxNumRetry: 0, retryDelayMs: 1000, maxRetryDelayMs: 8000 }
  return {
    default: {
      ...policy.default,
      errorRetry: {
        ...errorRetry,
        maxNumRetry: Math.max(errorRetry.maxNumRetry, MAX_AUTH_RETRIES),
        shouldRetry: (_config, retryCount, _isTimeout, response, retry) => {
          if (response?.code !== 403) return retry
          if (retryCount >= MAX_AUTH_RETRIES) return false
          void renewToken()
          return true
        },
      },
    },
  }
}

function tokenConfig(defaults: HlsConfig): Partial<HlsConfig> {
  return {
    // Chạy trước mỗi request; đợi token đang gia hạn (nếu có) rồi gắn token mới nhất.
    xhrSetup: async (xhr, url) => {
      if (renewing) await renewing
      xhr.open('GET', withToken(url), true)
    },
    manifestLoadPolicy: withAuthRetry(defaults.manifestLoadPolicy),
    playlistLoadPolicy: withAuthRetry(defaults.playlistLoadPolicy),
    fragLoadPolicy: withAuthRetry(defaults.fragLoadPolicy),
    keyLoadPolicy: withAuthRetry(defaults.keyLoadPolicy),
  }
}

async function setup() {
  const video = videoEl.value
  if (!video) return

  const [{ default: HlsCtor }, { default: PlyrCtor }] = await Promise.all([import('hls.js'), import('plyr')])
  if (disposed) return

  // Dọn trạng thái tắt tiếng Plyr đã lưu từ các bản trước.
  try {
    localStorage.removeItem('plyr')
  } catch {
    // Trình duyệt chặn storage (chế độ riêng tư…): không có gì để dọn.
  }

  const tokenMode = !!(props.stream || props.refreshStream)

  if (HlsCtor.isSupported()) {
    if (tokenMode && !(await renewToken())) return emit('error', 'expired')
    if (disposed) return

    hls = new HlsCtor({
      capLevelToPlayerSize: true,
      // Buffer ~1 phút: đủ thời gian xin token mới khi đổi mạng mà video không khựng.
      maxBufferLength: 60,
      ...(tokenMode ? tokenConfig(HlsCtor.DefaultConfig) : {}),
    })
    hls.on(HlsCtor.Events.MANIFEST_PARSED, (_, data) => {
      // 0 = tự động (ABR); các mức còn lại là chiều cao rendition BE đã encode.
      const heights = [...new Set(data.levels.map((level) => level.height))].sort((a, b) => b - a)
      player = new PlyrCtor(video, {
        ...PLYR_BASE,
        i18n: PLYR_I18N,
        quality: {
          default: 0,
          options: [0, ...heights],
          forced: true,
          onChange: (height: number) => {
            if (!hls) return
            hls.currentLevel = height === 0 ? -1 : hls.levels.findIndex((level) => level.height === height)
          },
        },
      })
    })
    hls.on(HlsCtor.Events.ERROR, (_, data) => {
      if (!data.fatal) return
      const status = data.response?.code
      if (status === 403) return emit('error', 'expired')
      if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) {
        hls?.recoverMediaError()
        return
      }
      emit('error', data.type === HlsCtor.ErrorTypes.NETWORK_ERROR ? 'network' : 'media')
    })
    hls.loadSource(props.src)
    hls.attachMedia(video)
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari / iOS phát HLS (kể cả AES-128) native. Video trên CDN: Worker gắn
    // sẵn token vào mọi URI trong playlist, token hạn dài vì không gia hạn được.
    if (tokenMode) {
      if (!(await renewToken(true))) return emit('error', 'expired')
      if (disposed) return
      let recovered = false
      video.addEventListener('error', async () => {
        // Token hết hạn / đổi IP: xin token mới một lần và phát tiếp từ chỗ cũ.
        if (recovered || disposed) return emit('error', 'network')
        recovered = true
        const resumeAt = video.currentTime
        if (!(await renewToken(true)) || disposed) return emit('error', 'expired')
        video.src = withToken(props.src)
        video.addEventListener('loadedmetadata', () => (video.currentTime = resumeAt), { once: true })
        void video.play().catch(() => {})
      })
      video.src = withToken(props.src)
    } else {
      video.src = props.src
    }
    player = new PlyrCtor(video, { ...PLYR_BASE, i18n: PLYR_I18N })
  } else {
    emit('error', 'unsupported')
  }
}

function teardown() {
  disposed = true
  clearTimeout(renewTimer)
  player?.destroy()
  player = null
  hls?.destroy()
  hls = null
}

// Plyr.destroy() thay <video> bằng một bản clone, nên không setup lại trên
// cùng element được: khi src đổi, parent phải remount component (:key="src").
onMounted(setup)
onBeforeUnmount(teardown)
</script>

<style>
.video-player {
  --plyr-color-main: rgb(var(--accent));
  /* Khung có chiều cao cố định theo tỉ lệ 16:9 để dùng được đơn vị cqh bên dưới. */
  container-type: size;
}

.video-player .plyr {
  height: 100%;
}

/*
 * Menu cài đặt (chất lượng / tốc độ) mở lên phía trên thanh điều khiển. Trên
 * màn hình nhỏ khung video chỉ cao ~200px, menu 6 mức chất lượng cao hơn thế
 * nên bị .plyr--video { overflow: hidden } cắt mất. Giới hạn chiều cao menu
 * theo khung (trừ thanh điều khiển ~60px) và cho cuộn bên trong.
 */
.video-player .plyr__menu__container > div {
  max-height: calc(100cqh - 64px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* Toàn màn hình: khung .video-player không đổi kích thước, nên tính theo viewport. */
.video-player .plyr--fullscreen-active .plyr__menu__container > div,
.video-player .plyr--fullscreen-fallback .plyr__menu__container > div {
  max-height: calc(100dvh - 80px);
}

@media (max-width: 480px) {
  /* Thu gọn khoảng cách mục menu để hiện được nhiều lựa chọn hơn trước khi phải cuộn. */
  .video-player {
    --plyr-control-spacing: 8px;
  }
}
</style>
