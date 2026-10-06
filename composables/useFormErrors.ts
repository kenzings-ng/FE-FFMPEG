import { GraphqlError } from '~/utils/graphql'

/**
 * Lỗi form: lỗi theo field (hiển thị dưới input) + lỗi chung (alert).
 * apply() nhận lỗi từ BE: lỗi validation của Lighthouse được gắn vào đúng field.
 */
export function useFormErrors<F extends string>(fields: readonly F[]) {
  const fieldErrors = reactive({}) as Partial<Record<F, string>>
  const formError = ref('')

  function reset() {
    for (const f of fields) delete fieldErrors[f]
    formError.value = ''
  }

  function set(field: F, message: string | undefined) {
    if (message) fieldErrors[field] = message
    else delete fieldErrors[field]
  }

  /** Focus vào input đầu tiên đang lỗi (id input = tên field). Trả true nếu có lỗi. */
  function focusFirst() {
    const first = fields.find((f) => fieldErrors[f])
    if (first) nextTick(() => document.getElementById(first)?.focus())
    return !!first
  }

  function apply(error: unknown) {
    if (error instanceof GraphqlError) {
      let matched = false
      for (const f of fields) {
        const message = error.field(f)
        if (message) {
          fieldErrors[f] = message
          matched = true
        }
      }
      // Lỗi validation đã hiện cạnh field thì không lặp lại "Dữ liệu không hợp lệ".
      // Lỗi validation của field không có trên form (vd. "token") thì hiện nguyên văn.
      formError.value = matched ? '' : (Object.values(error.validation)[0]?.[0] ?? errorMessage(error))
      focusFirst()
      return
    }
    formError.value = errorMessage(error)
  }

  return { fieldErrors, formError, reset, set, focusFirst, apply }
}
