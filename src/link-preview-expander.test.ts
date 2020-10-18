import { createStubSourcegraphAPI, createStubExtensionContext } from '@sourcegraph/extension-api-stubs'
jest.mock('sourcegraph')

import {
    getMetadataFromHTMLString,
    mergeMetadataProviders,
    metadataProviders,
    metadataAttributes,
    activate,
    MetadataByProvider,
} from './link-preview-expander'
import sourcegraph from 'sourcegraph'
const stubSourcegraph = sourcegraph as ReturnType<typeof createStubSourcegraphAPI>
import sinon from 'sinon'

describe('link-preview-expander', () => {
    it('should register a hover provider', () => {
        const context = createStubExtensionContext()
        activate(context)
        sinon.assert.calledOnce(stubSourcegraph.languages.registerHoverProvider)
    })

    // Expected result of `getMetadataFromHTMLString`, used as argument to `mergeMetadataProviders`
    const mockMetadataByProvider: MetadataByProvider = {
        openGraph: {
            image: 'https://mock.com/open-graph-image.png',
            title: '',
            description: 'Description from Open Graph',
        },
        twitter: {
            image: 'https://mock.com/twitter-image.png',
            title: 'Title from Twitter',
            description: 'Description from Twitter',
        },
        default: {
            image: 'https://mock.com/default-image.png',
            title: 'Title from title meta tag',
            description: 'Description from description meta tag',
        },
    }

    const htmlString = `<html><head>
    ${metadataProviders
        .flatMap(provider =>
            metadataAttributes.map(
                attribute =>
                    `<meta ${provider.selectorType}=${provider.selectorPrefix + attribute} content="${
                        mockMetadataByProvider[provider.type][attribute]
                    }">`
            )
        )
        .join('\n')}</head><body></body></html>`

    test('getMetadataFromHTMLString()', () => {
        expect(getMetadataFromHTMLString(htmlString)).toStrictEqual(mockMetadataByProvider)
    })

    test('mergeMetadataProviders()', () => {
        expect(mergeMetadataProviders(mockMetadataByProvider)).toStrictEqual({
            image: mockMetadataByProvider.openGraph.image,
            title: mockMetadataByProvider.twitter.title,
            description: mockMetadataByProvider.openGraph.description,
        })
    })
})
