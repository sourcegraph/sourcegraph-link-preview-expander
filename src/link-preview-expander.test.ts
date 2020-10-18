import { createStubSourcegraphAPI, createStubExtensionContext } from '@sourcegraph/extension-api-stubs'
jest.mock('sourcegraph')

import {
    getMetadataFromHTMLString,
    initializeMetadata,
    mergeMetadataProviders,
    metadataProviders,
    metadataAttributes,
    activate,
} from './link-preview-expander'
import sourcegraph from 'sourcegraph'
const stubSourcegraph = sourcegraph as ReturnType<typeof createStubSourcegraphAPI>
import sinon from 'sinon'

describe('link-preview-expander', () => {
    it('should register a hover provider', async () => {
        const context = createStubExtensionContext()
        console.log({
            sourcegraph,
            context,
        })
        activate(context)
        sinon.assert.calledOnce(stubSourcegraph.languages.registerHoverProvider)
        // More assertions ...
    })

    // Expected result of `getMetadataFromHTMLString`, used as argument to `mergeMetadataProviders`
    const htmlString = `<html><head>
    ${metadataProviders
        .flatMap(provider =>
            metadataAttributes.map(
                attribute =>
                    `<meta ${provider.selectorType}=${provider.selectorPrefix + attribute} content="fake content">`
            )
        )
        .join('\n')}
    </head></html>`

    console.log(htmlString)

    test.skip('getMetadataFromHTMLString()', () => {
        const metadataByProvider = getMetadataFromHTMLString(htmlString)
        // TODO
    })

    test.skip('mergeMetadataProviders()', () => {
        const finalMetadata = mergeMetadataProviders({
            openGraph: initializeMetadata(),
            twitter: initializeMetadata(),
            default: initializeMetadata(),
        })
        // TODO
    })
})
