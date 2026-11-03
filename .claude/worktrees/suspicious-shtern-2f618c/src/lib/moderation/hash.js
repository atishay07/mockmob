import { createHash } from 'crypto'

/**
 * Produces a stable SHA-256 fingerprint of a question's identifying content.
 * Normalisation strips punctuation, collapses whitespace, and lowercases so
 * that trivially reworded duplicates hash to the same value.
 */
export function computeContentHash(body, correctAnswer) {
  const normalised =
    [body, correctAnswer]
      .map(s =>
        s
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')   // punctuation → space
          .replace(/\s+/g, ' ')        // collapse whitespace
          .trim()
      )
      .join('||')

  return createHash('sha256').update(normalised).digest('hex')
}
