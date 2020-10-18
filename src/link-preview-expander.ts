import * as sourcegraph from 'sourcegraph'
import { checkIsURL, cleanURL, createMetadataCache, FAILURE, getWord } from './util'
import parse from 'node-html-parser'

export function activate(context: sourcegraph.ExtensionContext): void {
    const metadataCache = createMetadataCache({})

    context.subscriptions.add(
        sourcegraph.languages.registerHoverProvider(['*'], {
            provideHover: (document, position) => {
                const range = document.getWordRangeAtPosition(position)
                if (!range) {
                    return null
                }
                const maybeURL = cleanURL(getWord(document, range))
                const isURL = checkIsURL(maybeURL)

                if (!isURL) {
                    return null
                }

                /**
                 * Creates the markdown string to be rendered in the hover tooltip.
                 */
                const createResult: (metadata?: Metadata) => sourcegraph.Badged<sourcegraph.Hover> = metadata => {
                    const { image, title, description } = metadata || {}
                    return {
                        contents: {
                            value: `<img height="64" src="${image || '#'}" style="${image ? '' : 'display: none;'}" />
                                    <h3>${title ?? ''}</h3>
                                    <p>${description ?? ''}</p>
                                    <p><a href="${maybeURL}" target="_blank" rel="noopener noreferrer">Navigate to link!!</a></p>`,
                            kind: sourcegraph.MarkupKind.Markdown,
                        },
                    }
                }

                const cachedMetadata = metadataCache.get(maybeURL)

                // Requests to the hovered URL have failed too many times, so just display a link
                if (cachedMetadata === FAILURE) {
                    return createResult()
                }

                // We have retrieved this URLs metadata within `maxAge`, so display it without re-fetching
                if (cachedMetadata) {
                    return createResult(cachedMetadata)
                }

                /**
                 * At this point, we fetch because:
                 * - We may not have retrieved this URLs metadata yet
                 * - This URL's metadata may have been evicted from the cache
                 * - This URL's metadata may be too old (age greater than `maxAge` option)
                 */
                // TODO(tj): Return async iterable (once allowed) instead of promise so that we can show link before metadata loads
                return fetch('https://cors-anywhere.herokuapp.com/' + maybeURL)
                    .then(response => response.text())
                    .then(text => {
                        const metadata = mergeMetadataProviders(getMetadataFromHTMLString(text))
                        metadataCache.set(maybeURL, metadata)
                        return createResult(metadata)
                    })
                    .catch(() => {
                        metadataCache.reportFailure(maybeURL)
                        return createResult()
                    })
            },
        })
    )
}

export const metadataAttributes = ['image', 'title', 'description'] as const
type MetadataAttributes = typeof metadataAttributes[number]

export type Metadata = Record<MetadataAttributes, string>

interface MetadataProvider<T = string> {
    type: T
    selectorType: 'property' | 'name'
    selectorPrefix: string
}

type MetadataProviderType = 'openGraph' | 'twitter' | 'default'

export type MetadataByProvider = Record<MetadataProviderType, Metadata>

// In order of priority in the 'metadata cascade'
export const metadataProviders: MetadataProvider<MetadataProviderType>[] = [
    {
        type: 'openGraph',
        selectorType: 'property',
        selectorPrefix: 'og:',
    },
    {
        type: 'twitter',
        selectorType: 'name',
        selectorPrefix: 'twitter:',
    },
    {
        type: 'default',
        selectorType: 'name',
        selectorPrefix: '',
    },
]

/**
 * Merges metadata by priority of provider type.
 *
 * @param metadataByProvider Record of Metadata objects keyed by metadata provider type
 */
export function mergeMetadataProviders(metadataByProvider: MetadataByProvider): Metadata {
    const finalMetadata = initializeMetadata()

    for (const attribute of metadataAttributes) {
        for (const { type } of metadataProviders) {
            const value = metadataByProvider[type][attribute]
            if (value) {
                finalMetadata[attribute] = value
                break
            }
        }
    }

    return finalMetadata
}

/**
 * Retrieves metadata from all providers given an HTML string
 */
export function getMetadataFromHTMLString(htmlString: string): MetadataByProvider {
    const root = parse(htmlString)

    const metadataByProvider: MetadataByProvider = {
        openGraph: initializeMetadata(),
        twitter: initializeMetadata(),
        default: initializeMetadata(),
    }

    if (!root.valid) {
        return metadataByProvider
    }

    // node-html-parser doesn't support this selector: 'meta[property="og:image"]'
    const metaElements = root.querySelectorAll('meta')

    outer: for (const metaElement of metaElements) {
        for (const { type, selectorType, selectorPrefix } of metadataProviders) {
            for (const attribute of metadataAttributes) {
                const propertyOrName = metaElement.getAttribute(selectorType)
                if (propertyOrName === selectorPrefix + attribute) {
                    metadataByProvider[type][attribute] = metaElement.getAttribute('content') ?? ''
                    continue outer
                }
            }
        }
    }

    return metadataByProvider
}

/**
 * Returns an object with each metadata attribute initialized with an empty string
 */
export function initializeMetadata(): Metadata {
    return {
        image: '',
        title: '',
        description: '',
    }
}

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
