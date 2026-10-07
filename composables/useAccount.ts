import type { User } from '~/utils/api'

/** Thông tin user hiện tại, cập nhật hồ sơ và đăng xuất (cần cả auth lẫn GraphQL). */
export function useAccount() {
  const auth = useAuth()
  const { query } = useGraphql()

  async function loadUser(force = false) {
    if (!auth.isLoggedIn.value || (auth.user.value && !force)) return auth.user.value
    const data = await query<{ me: User }>(ME_QUERY)
    auth.setUser(data.me)
    return data.me
  }

  async function updateProfile(input: { name?: string; username?: string; bio?: string; current_password?: string; password?: string }) {
    const data = await query<{ updateProfile: User }>(UPDATE_PROFILE_MUTATION, input)
    auth.setUser(data.updateProfile)
    return data.updateProfile
  }

  async function resendVerificationEmail() {
    await query(RESEND_VERIFICATION_MUTATION)
  }

  async function logout() {
    try {
      // Revoke access + refresh token phía BE; lỗi mạng vẫn phải xóa phiên ở client.
      await query(LOGOUT_MUTATION)
    } catch {}
    auth.clear()
    await navigateTo('/login')
  }

  return { user: auth.user, loadUser, updateProfile, resendVerificationEmail, logout }
}
