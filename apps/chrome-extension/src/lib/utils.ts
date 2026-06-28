import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

import filenamify from 'filenamify/browser'

/**
 * Normalizes a filename by:
 * 1. Removing invisible Unicode characters (like zero-width joiners) which can bloat the byte length
 * 2. Using filenamify to strip illegal OS characters
 * 3. Truncating the UTF-8 byte length to a safe limit (e.g. 200 bytes for ext4/windows limits), preserving extension
 */
export function safeNormalizeFileName(
  filename: string,
  maxBytes = 200,
): string {
  // Remove invisible Unicode characters (zero-width space, joiners, LRM, RLM, BOM, etc.)
  let cleaned = filename.replace(
    /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,
    '',
  )

  // Strip illegal OS characters
  cleaned = filenamify(cleaned, { maxLength: 255 })

  const encoder = new TextEncoder()
  const bytes = encoder.encode(cleaned)

  if (bytes.length <= maxBytes) {
    return cleaned
  }

  // Truncate while preserving extension
  const lastDotIdx = cleaned.lastIndexOf('.')
  let ext = ''
  let name = cleaned
  if (lastDotIdx > 0) {
    ext = cleaned.substring(lastDotIdx)
    name = cleaned.substring(0, lastDotIdx)
  }

  const extBytes = encoder.encode(ext).length
  if (extBytes >= maxBytes) {
    // If extension alone is huge, just truncate everything
    return new TextDecoder()
      .decode(bytes.slice(0, maxBytes))
      .replace(/\uFFFD$/, '')
  }

  const maxNameBytes = maxBytes - extBytes
  const nameBytes = encoder.encode(name)
  const truncatedNameBytes = nameBytes.slice(0, maxNameBytes)

  // TextDecoder replaces broken sequences with \uFFFD. We strip it if present.
  let truncatedName = new TextDecoder().decode(truncatedNameBytes)
  truncatedName = truncatedName.replace(/\uFFFD$/, '')

  return truncatedName + ext
}
