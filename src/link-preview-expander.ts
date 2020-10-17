import * as sourcegraph from 'sourcegraph'
import { concat, of, pipe } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'
import { catchError, map, switchMap } from 'rxjs/operators'
import { checkIsURL, cleanURL, createMetadataCache, getWord } from './util'
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
                 * TODO: document behavior/intended usage
                 *
                 * @param metadata
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

                // If cached, early return

                return concat(
                    of(createResult()),
                    fromFetch('https://cors-anywhere.herokuapp.com/' + maybeURL).pipe(
                        switchMap(response => response.text()),
                        map(pipe(getMetadataFromHTMLString, mergeMetadataProviders, createResult)),
                        catchError(() => {
                            metadataCache.reportFailure(maybeURL)
                            return of(createResult())
                        })
                    )
                )
            },
        })
    )
}

const metadataAttributes = ['image', 'title', 'description'] as const
type MetadataAttributes = typeof metadataAttributes[number]

export type Metadata = Record<MetadataAttributes, string>

interface MetadataProvider<T = string> {
    type: T
    selectorType: 'property' | 'name'
    selectorPrefix: string
}

type MetadataProviderType = 'openGraph' | 'twitter'

type MetadataByProvider = Record<MetadataProviderType, Metadata>

// In order of priority in the 'metadata cascade'
const metadataProviders: MetadataProvider<MetadataProviderType>[] = [
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
]

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

export function getMetadataFromHTMLString(htmlString: string): MetadataByProvider {
    const root = parse(htmlString)

    const metadataByProvider: MetadataByProvider = {
        openGraph: initializeMetadata(),
        twitter: initializeMetadata(),
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
 *
 */
export function initializeMetadata(): Metadata {
    return {
        image: '',
        title: '',
        description: ''
    }
}

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
