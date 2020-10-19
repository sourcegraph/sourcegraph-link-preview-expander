import * as sourcegraph from 'sourcegraph'
import { checkIsURL, cleanURL, getWord } from './util'
import parse from 'node-html-parser'

export function activate(context: sourcegraph.ExtensionContext): void {
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
                    const { image, title, description } = metadata ?? {}

                    let markdownContent = `<h4><a href="${maybeURL}" target="_blank" rel="noopener noreferrer">${
                        title || maybeURL
                    }</a></h4>`

                    if (image || description) {
                        markdownContent += '<hr />'

                        if (image) {
                            markdownContent += `<img height="64" src="${image}" />`
                        }

                        if (description) {
                            // Extra <p /> for margin
                            markdownContent += `<p /><p>${description ?? ''}</p>`
                        }
                    }

                    return {
                        contents: {
                            value: markdownContent,
                            kind: sourcegraph.MarkupKind.Markdown,
                        },
                    }
                }

                // TODO(tj): Return async iterable (once allowed) instead of promise so that we can show link before metadata loads
                return fetch('https://cors-anywhere.herokuapp.com/' + maybeURL, { cache: 'force-cache' })
                    .then(response => response.text())
                    .then(text => {
                        const metadata = getMetadataFromHTMLString(text)
                        return createResult(metadata)
                    })
                    .catch(() => createResult())
            },
        })
    )
}

export const metadataAttributes = ['image', 'title', 'description'] as const
type MetadataAttributes = typeof metadataAttributes[number]

export type Metadata = Record<MetadataAttributes, string>

interface MetadataProvider {
    selectorType: 'property' | 'name'
    selectorPrefix: string
}

export const metadataProviders: MetadataProvider[] = [
    {
        selectorType: 'property',
        selectorPrefix: 'og:',
    },
    {
        selectorType: 'name',
        selectorPrefix: 'twitter:',
    },
    {
        selectorType: 'name',
        selectorPrefix: '',
    },
]

/**
 * Retrieves metadata given an HTML string
 */
export function getMetadataFromHTMLString(htmlString: string): Metadata {
    const root = parse(htmlString)

    const metadata = initializeMetadata()

    if (!root.valid) {
        return metadata
    }

    // node-html-parser doesn't support this selector: 'meta[property="og:image"]'
    const metaElements = root.querySelectorAll('meta')

    const attributes = [...metadataAttributes]

    outer: for (const metaElement of metaElements) {
        // We have found valid values for all attributes
        if (attributes.length === 0) {
            break
        }

        for (const { selectorType, selectorPrefix } of metadataProviders) {
            for (const [index, attribute] of attributes.entries()) {
                const propertyOrName = metaElement.getAttribute(selectorType)
                if (propertyOrName === selectorPrefix + attribute) {
                    const content = metaElement.getAttribute('content')
                    if (content) {
                        // A valid value for this attribute has been found; stop looking for it.
                        metadata[attribute] = content
                        attributes.splice(index, 1)
                    }
                    continue outer
                }
            }
        }
    }

    // Override default title with <title /> tag
    if (!metadata.title) {
        const title = root.querySelector('title')?.rawText
        metadata.title = title
    }

    return metadata
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
