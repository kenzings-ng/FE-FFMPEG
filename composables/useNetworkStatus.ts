/**
 * Trạng thái mạng của trình duyệt (navigator.onLine + sự kiện online/offline).
 * Dùng chung một state cho toàn app, chỉ gắn listener một lần.
 */
let listening = false

export function useNetworkStatus() {
  const online = useState('network.online', () => (import.meta.client ? navigator.onLine : true))
  /** Vừa có mạng lại (để hiện thông báo ngắn). */
  const justReconnected = useState('network.reconnected', () => false)

  if (import.meta.client && !listening) {
    listening = true
    let timer: ReturnType<typeof setTimeout> | undefined
    window.addEventListener('offline', () => {
      online.value = false
      justReconnected.value = false
    })
    window.addEventListener('online', () => {
      online.value = true
      justReconnected.value = true
      clearTimeout(timer)
      timer = setTimeout(() => (justReconnected.value = false), 4000)
    })
  }

  /**
   * navigator.onLine chỉ biết có card mạng hay không, không biết có ra được
   * internet. Bấm "Thử lại" thì gọi thật tới API để kiểm tra.
   */
  async function check(apiBase: string): Promise<boolean> {
    try {
      await fetch(`${apiBase}/graphql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ __typename }' }),
        cache: 'no-store',
      })
      online.value = true
    } catch {
      online.value = false
    }
    return online.value
  }

  return { online, justReconnected, check }
}
