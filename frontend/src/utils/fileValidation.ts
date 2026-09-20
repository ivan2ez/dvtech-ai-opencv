/** Shared client-side validation for image file inputs. */

export interface ImageValidationOptions {
  /** Maximum allowed size in megabytes. */
  maxMB: number;
  /** Allowed MIME types. */
  types: string[];
  /** Human-readable list of accepted formats for error messages (e.g. "JPEG, PNG"). */
  typeLabel?: string;
}

/**
 * Validates a single image file against type and size constraints.
 * Returns an error message string, or null when the file is valid.
 */
export function validateImageFile(
  file: File,
  { maxMB, types, typeLabel }: ImageValidationOptions
): string | null {
  if (!types.includes(file.type)) {
    const label = typeLabel ?? types.map((t) => t.replace('image/', '').toUpperCase()).join(', ');
    return `Only ${label} images are accepted.`;
  }
  if (file.size > maxMB * 1024 * 1024) {
    return `Image must be ${maxMB}MB or smaller.`;
  }
  return null;
}
