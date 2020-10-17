import * as sourcegraph from 'sourcegraph'

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

interface MetadataCache {}

export function createMetadataCache() {}
