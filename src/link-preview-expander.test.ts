import { createStubSourcegraphAPI, createStubExtensionContext } from '@sourcegraph/extension-api-stubs'
import mock from 'mock-require'
const sourcegraph = createStubSourcegraphAPI()
mock('sourcegraph', sourcegraph)

import {
    getMetadataFromHTMLString,
    metadataProviders,
    metadataAttributes,
    activate,
    Metadata,
} from './link-preview-expander'
import sinon from 'sinon'
import * as assert from 'assert'

describe('link-preview-expander', () => {
    it('should register a hover provider', () => {
        const context = createStubExtensionContext()
        activate(context)
        sinon.assert.calledOnce(sourcegraph.languages.registerHoverProvider)
    })

    // Expected result of `getMetadataFromHTMLString`, used as argument to `mergeMetadataProviders`
    const mockMetadataByProvider: Record<string, Metadata> = {
        'og:': {
            image: 'https://mock.com/image.png',
            title: 'Title',
            description: 'Description',
        },
        'twitter:': {
            image: 'https://mock.com/image.png',
            title: 'Title',
            description: 'Description',
        },
        default: {
            image: '',
            title: '',
            description: 'Description from description meta tag',
        },
    }

    const htmlString = `<html><head>
    ${metadataProviders
        .flatMap(provider =>
            metadataAttributes.map(
                attribute =>
                    `<meta ${provider.selectorType}=${provider.selectorPrefix + attribute} content="${
                        mockMetadataByProvider[provider.selectorPrefix || 'default'][attribute]
                    }">`
            )
        )
        .join('\n')}</head><body></body></html>`

    it('getMetadataFromHTMLString()', () => {
        assert.deepStrictEqual(getMetadataFromHTMLString(htmlString), {
            image: 'https://mock.com/image.png',
            title: 'Title',
            description: 'Description',
        })
    })
})
