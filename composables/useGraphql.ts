/**
 * Client GraphQL cho Lighthouse: gắn Bearer token, tự refresh một lần khi BE
 * báo "Unauthenticated", và upload file theo GraphQL multipart spec
 * (https://github.com/jaydenseric/graphql-multipart-request-spec) kèm tiến độ.
 */
import { GraphqlError, postGraphql, toGraphqlError, type GraphqlResponse } from '~/utils/graphql'

export interface UploadOptions {
  signal?: AbortSignal
  onProgress?: (fraction: number) => void
}

export function useGraphql() {
  const config = useRuntimeConfig()
  const auth = useAuth()
  const endpoint = `${config.public.apiBase}/graphql`

  async function withAuthRetry<T>(send: (token: string | null) => Promise<T>): Promise<T> {
    try {
      return await send(await auth.getAccessToken())
    } catch (error) {
      // Token có thể bị revoke phía BE trước khi hết hạn: thử refresh đúng một lần.
      if (error instanceof GraphqlError && error.isUnauthenticated && auth.session.value) {
        await auth.refresh()
        return send(await auth.getAccessToken())
      }
      throw error
    }
  }

  function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    return withAuthRetry((token) => postGraphql<T>(endpoint, document, variables, token))
  }

  /**
   * Upload một file. `fileVariable` là tên biến kiểu Upload! trong document.
   * Dùng XMLHttpRequest vì fetch chưa báo được tiến độ upload.
   */
  function upload<T>(
    document: string,
    variables: Record<string, unknown>,
    fileVariable: string,
    file: File,
    options: UploadOptions = {},
  ): Promise<T> {
    return withAuthRetry(
      (token) =>
        new Promise<T>((resolve, reject) => {
          const form = new FormData()
          form.append('operations', JSON.stringify({ query: document, variables: { ...variables, [fileVariable]: null } }))
          form.append('map', JSON.stringify({ 0: [`variables.${fileVariable}`] }))
          form.append('0', file)

          const xhr = new XMLHttpRequest()
          xhr.open('POST', endpoint)
          xhr.setRequestHeader('Accept', 'application/json')
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) options.onProgress?.(event.loaded / event.total)
          }
          xhr.onload = () => {
            let body: GraphqlResponse<T> | null = null
            try {
              body = JSON.parse(xhr.responseText)
            } catch {}
            const error = toGraphqlError(xhr.status, body)
            if (error) reject(error)
            else resolve(body!.data as T)
          }
          xhr.onerror = () => reject(new GraphqlError('Mất kết nối tới máy chủ khi đang tải lên.', [], 0))
          xhr.onabort = () => reject(new DOMException('Đã hủy tải lên.', 'AbortError'))

          options.signal?.addEventListener('abort', () => xhr.abort(), { once: true })
          xhr.send(form)
        }),
    )
  }

  return { query, upload }
}
