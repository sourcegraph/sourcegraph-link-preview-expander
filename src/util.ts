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
    return maybeURL.replace(/[,.]$/, '')
}
