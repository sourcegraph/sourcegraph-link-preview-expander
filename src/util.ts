import * as sourcegraph from 'sourcegraph'
import { Metadata } from './link-preview-expander'
import LRU from 'lru-cache'

export function getWord(document: sourcegraph.TextDocument, range: sourcegraph.Range): string {
    const lines = document.text?.split('\n')
    let word = ''
    if (lines && range) {
        word = lines[range.start.line].slice(range.start.character, range.end.character)
    }
    return word
}

export function checkIsURL(maybeURL: string): boolean {
    try {
        const url = new URL(maybeURL)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

/**
 * Strips trailing comma or period from URL
 *
 * @param maybeURL Possible URL string
 */
export function cleanURL(maybeURL: string): string {
    const lastCharacter = maybeURL.slice(-1)
    if (lastCharacter === '.' || lastCharacter === ',') {
        return maybeURL.slice(0, -1)
    }
    return maybeURL
}

export const FAILURE = Symbol('FAILURE')

interface MetadataCache {
    /** Report a failed fetch for a URL */
    reportFailure: (URL: string) => void

    /**
     * Returns undefined when cached value is not of Metadata type and
     * number of failures is below the retry threshold.
     */
    get: (URL: string) => Metadata | typeof FAILURE | undefined

    /**
     * Store successful metadata for a URL
     */
    set: (URL: string, metadata: Metadata) => void
}

/**
 * Creates a simple LRU cache for metadata.
 *
 * Motivation:
 * - It's easy for users to trigger multiple hovers unintentionally
 * - Users may hover over the same URL several times to re-read previews
 * - Don't want to blow through cors-anywhere rate-limit
 * - Hover to presented metadata is a relatively expensive process.
 * (fetch -> parse html -> merge content from relevant meta tags)
 */
export function createMetadataCache(
    options: LRU.Options<string, Metadata | number> & { retries?: number }
): MetadataCache {
    // URL -> metadata or number of failures
    const cache = new LRU<string, Metadata | number>({ max: 100, maxAge: 1000 * 60 * 60, ...options })
    // Only allow positive, non-zero retry threshold
    const retryThreshold = options.retries && options.retries > 0 ? options.retries : 2

    return {
        reportFailure: url => {
            // Don't overwrite successful responses with failure count.
            // Realistically, this will never happen, as request wouldn't
            // be made if there was a Metadata value for this key in the cache.
            const value = cache.peek(url)

            if (typeof value === 'object') {
                return
            }

            const failures = (value ?? 0) + 1
            if (failures <= retryThreshold) {
                cache.set(url, failures)
            }
        },
        get: url => {
            const value = cache.get(url)

            // Only return FAILURE if failure count has reached retry threshold
            if (typeof value === 'number') {
                if (value >= retryThreshold) {
                    return FAILURE
                }
                // Ensure that caller will try again
                return undefined
            }

            return value
        },
        set: (url, metadata) => {
            cache.set(url, metadata)
        },
    }
}
