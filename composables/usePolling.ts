/**
 * Gọi `fn` định kỳ khi đang resume. Tạm dừng khi tab bị ẩn để không tốn request
 * (BE có rate limit 60 request/phút cho /graphql).
 */
export function usePolling(fn: () => unknown, intervalMs: number) {
  let timer: ReturnType<typeof setInterval> | null = null
  const active = ref(false)

  function start() {
    if (timer || !active.value || document.hidden) return
    timer = setInterval(fn, intervalMs)
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  function onVisibility() {
    if (document.hidden) stop()
    else if (active.value) {
      fn()
      start()
    }
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    resume() {
      active.value = true
      start()
    },
    pause() {
      active.value = false
      stop()
    },
  }
}
