import axios from 'axios'

export interface ApiError {
  status: number
  message: string
}

export function extractApiError(error: unknown, fallback = 'Request failed'): ApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0
    const data = error.response?.data as { error?: string } | undefined
    const message = data?.error ?? error.message ?? fallback
    return { message, status }
  }
  if (error instanceof Error) {
    return { message: error.message, status: 0 }
  }
  return { message: fallback, status: 0 }
}
