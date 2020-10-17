import * as sourcegraph from 'sourcegraph'
import { Metadata } from './link-preview-expander'

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

const FAILURE = Symbol('FAILURE')

interface MetadataCache {
    /** Report a failed fetch for a URL. Increments failure count for URL */
    reportFailure: (URL: string) => void

    /**
     * Returns null when cached value is not of Metadata type and
     * number of failures is below the retry threshold.
     */
    get: (URL: string) => Metadata | typeof FAILURE | null

    /**
     *
     */
    set: (URL: string, metadata: Metadata) => void
}

/**
 * Creates a simple LRU cache for
 *
 *
 *
 * motivation:
 */
export function createMetadataCache({
    maxSize = 100,
    retries = 2,
}: {
    maxSize?: number
    retries?: number
}): MetadataCache {
    // URL -> metadata or number of failures
    const cache = new Map<string, Metadata | number>()

    return {
        reportFailure: () => {},
        get: () => {
            // TODO
            if (retries < 0) {
                return FAILURE
            }

            return FAILURE
        },
        set: () => {
            if (cache.size >= maxSize) {
                // TODO
            }
        },
    }
}
