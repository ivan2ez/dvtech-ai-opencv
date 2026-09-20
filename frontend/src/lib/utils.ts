import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Pulls the backend's `message` out of an axios-style error so specific server
 * rules (e.g. the completion handler's 400/409/413/415/500 messages) surface to
 * the user verbatim instead of a generic fallback.
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as Record<string, unknown>).response === "object"
  ) {
    const response = (err as { response: { data?: { message?: string } } }).response
    if (response?.data?.message) return response.data.message
  }
  return fallback
}
