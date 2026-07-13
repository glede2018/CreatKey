const API_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  /** 保存 HTTP 状态码，便于调用方区分未登录等业务场景。 */
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 统一发送带 Cookie 的 JSON API 请求，并标准化错误处理。 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body.message ?? "请求失败");
  return body as T;
}
