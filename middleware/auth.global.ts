/**
 * Mọi query video/user ở BE đều có @guard, nên chỉ các trang auth bên dưới
 * là xem được khi chưa đăng nhập.
 */

/** Chỉ dành cho khách: đã đăng nhập thì chuyển về thư viện. */
const GUEST_ONLY_ROUTES = new Set(['/login', '/register', '/forgot-password', '/reset-password'])
/** Ai cũng vào được (link trong email có thể mở ở trình duyệt chưa đăng nhập). */
const OPEN_ROUTES = new Set(['/email-verified'])

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuth()

  if (OPEN_ROUTES.has(to.path)) return

  if (GUEST_ONLY_ROUTES.has(to.path)) {
    if (auth.isLoggedIn.value) return navigateTo('/')
    return
  }

  if (!auth.isLoggedIn.value) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} })
  }

  try {
    await useAccount().loadUser()
  } catch {
    // Refresh token hết hạn / bị revoke: useAuth đã xóa phiên.
    if (!auth.isLoggedIn.value) return navigateTo('/login')
  }
})
