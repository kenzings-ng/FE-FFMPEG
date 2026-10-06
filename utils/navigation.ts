/**
 * Chỉ chấp nhận đường dẫn nội bộ ("/x") cho ?redirect=, chặn "//evil.com" và
 * "/\evil.com" (open redirect).
 */
export function safeRedirect(target: unknown): string {
  return typeof target === 'string' && /^\/(?![/\\])/.test(target) ? target : '/'
}
