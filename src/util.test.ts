import { initializeMetadata } from './link-preview-expander'
import { checkIsURL, cleanURL, createMetadataCache, FAILURE } from './util'

describe('util', () => {
    describe('metadata cache', () => {
        const mockURLs = [
            'https://docs.sourcegraph.com',
            'https://github.com/sourcegraph',
            'https://mock.site',
        ] as const
        it('returns FAILURE after retry threshold reached', () => {
            const metadataCache = createMetadataCache({ retries: 2 })

            metadataCache.reportFailure(mockURLs[0])
            expect(metadataCache.get(mockURLs[0])).toBe(undefined)
            metadataCache.reportFailure(mockURLs[0])
            expect(metadataCache.get(mockURLs[0])).toBe(FAILURE)
        })

        it('evicts the least recently used URL after max size reached', () => {
            const metadataCache = createMetadataCache({ max: 2 })
            const mockMetadata = initializeMetadata()

            metadataCache.set(mockURLs[0], mockMetadata)
            metadataCache.set(mockURLs[1], mockMetadata)
            metadataCache.get(mockURLs[1])
            metadataCache.get(mockURLs[0])
            metadataCache.set(mockURLs[2], mockMetadata)

            expect(metadataCache.get(mockURLs[0])).toStrictEqual(mockMetadata)
            expect(metadataCache.get(mockURLs[1])).toStrictEqual(undefined)
            expect(metadataCache.get(mockURLs[2])).toStrictEqual(mockMetadata)
        })
    })

    describe('checkIsUrl', () => {
        it('returns true for valid URLs', () => {
            expect(checkIsURL('https://sourcegraph.com/extensions')).toBe(true)
        })

        test('returns false for invalid URLs', () => {
            expect(checkIsURL('//sourcegraph/extensions')).toBe(false)
        })
    })

    describe('cleanURL', () => {
        it('strips last character when it is a period or comma', () => {
            expect(cleanURL('https://sourcegraph.com/extensions,')).toBe('https://sourcegraph.com/extensions')
        })

        it('does not strip last character when it is not a period or comma', () => {
            expect(cleanURL('https://sourcegraph.com/extensions')).toBe('https://sourcegraph.com/extensions')
        })
    })
})
