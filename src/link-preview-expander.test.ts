import { getMetadataFromHTMLString, initializeMetadata, mergeMetadataProviders } from './link-preview-expander'

describe('link-preview-expander', () => {
    test('works', () => {
        console.log('hello from the test!')
        expect(true).toBe(true)
    })

    test('getMetadataFromHTMLString()', () => {
        const metadataByProvider = getMetadataFromHTMLString('<html></html>')
        // TODO
    })

    test('mergeMetadataProviders()', () => {
        const finalMetadata = mergeMetadataProviders({
            openGraph: initializeMetadata(),
            twitter: initializeMetadata(),
        })
        // TODO
    })
})
