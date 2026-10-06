/**
 * Lớp gửi request GraphQL thấp nhất (không biết gì về auth), dùng chung cho
 * useAuth (login/register/refresh) và useGraphql (mọi query khác).
 */

interface GraphqlErrorPayload {
  message: string
  extensions?: {
    category?: string
    validation?: Record<string, string[]>
  }
}

export interface GraphqlResponse<T> {
  data?: T
  errors?: GraphqlErrorPayload[]
}

export class GraphqlError extends Error {
  constructor(
    message: string,
    public readonly errors: GraphqlErrorPayload[] = [],
    public readonly status = 200,
  ) {
    super(message)
  }

  get isUnauthenticated() {
    return this.errors.some((e) => e.message === 'Unauthenticated.' || e.extensions?.category === 'authentication')
  }

  get isForbidden() {
    return this.errors.some((e) => e.message === 'This action is unauthorized.' || e.extensions?.category === 'authorization')
  }

  get isRateLimited() {
    return this.status === 429 || this.errors.some((e) => /rate limit|too many/i.test(e.message))
  }

  /** Lỗi validate theo từng argument, ví dụ { email: ['...'] }. */
  get validation(): Record<string, string[]> {
    const merged: Record<string, string[]> = {}
    for (const e of this.errors) {
      for (const [key, messages] of Object.entries(e.extensions?.validation ?? {})) {
        merged[key.replace(/^input\./, '')] = messages
      }
    }
    return merged
  }

  /** Thông báo đầu tiên của một field (hoặc undefined). */
  field(name: string): string | undefined {
    return this.validation[name]?.[0]
  }
}

export function toGraphqlError<T>(status: number, body: GraphqlResponse<T> | null): GraphqlError | null {
  if (status === 429) return new GraphqlError('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', [], 429)
  if (status === 413) return new GraphqlError('File quá lớn so với giới hạn của máy chủ.', [], 413)
  if (!body) return new GraphqlError(`Máy chủ trả về lỗi (${status}).`, [], status)
  if (body.errors?.length) {
    const error = new GraphqlError(body.errors[0].message, body.errors, status)
    if (error.isRateLimited) return new GraphqlError('Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.', body.errors, status)
    if (Object.keys(error.validation).length) return new GraphqlError('Dữ liệu không hợp lệ.', body.errors, status)
    return error
  }
  return null
}

export async function postGraphql<T>(
  endpoint: string,
  document: string,
  variables: Record<string, unknown> = {},
  token?: string | null,
): Promise<T> {
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query: document, variables }),
    })
  } catch {
    throw new GraphqlError('Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.', [], 0)
  }
  const body = (await res.json().catch(() => null)) as GraphqlResponse<T> | null
  const error = toGraphqlError(res.status, body)
  if (error) throw error
  return body!.data as T
}
