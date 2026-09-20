/**
 * Shared helpers for the technician/admin task-completion photo upload.
 *
 * The backend requires a photo when completing a task (multipart field
 * `photo`, max 10MB). We restrict to common image types and validate size on
 * the client so the user gets immediate feedback instead of a 400.
 */

export const MAX_COMPLETION_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB (matches multer limit)
export const ACCEPTED_COMPLETION_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const COMPLETION_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Base URL for resolving relative /uploads paths returned by the backend. */
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

/**
 * Validates a chosen completion photo. Returns an error message string, or
 * null when the file is acceptable.
 */
export function validateCompletionPhoto(file: File | null): string | null {
  if (!file) return 'A completion photo is required.';
  if (!ACCEPTED_COMPLETION_PHOTO_TYPES.includes(file.type)) {
    return 'Photo must be a JPG, PNG, or WebP image.';
  }
  if (file.size > MAX_COMPLETION_PHOTO_BYTES) {
    return 'Photo must be 10MB or smaller.';
  }
  return null;
}

/** Resolves a backend photo path (e.g. "uploads/completion-photos/x.jpg") to a full URL. */
export function resolveUploadUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}
