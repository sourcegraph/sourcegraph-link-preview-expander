import * as sourcegraph from 'sourcegraph'
import { checkIsURL, cleanURL } from './util'
import parse from 'node-html-parser'

interface Settings {
    ['linkPreviewExpander.corsAnywhereUrl']?: string
}

export function activate(context: sourcegraph.ExtensionContext): void {
    context.subscriptions.add(
        sourcegraph.languages.registerHoverProvider(['*'], {
            async *provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position)
                const word = document.getText(range)
                if (!word) {
                    return
                }

                const maybeURL = cleanURL(word)

                if (!checkIsURL(maybeURL)) {
                    return
                }

                /**
                 * Creates the markdown string to be rendered in the hover tooltip.
                 */
                const createResult: (metadata?: Metadata) => sourcegraph.Badged<sourcegraph.Hover> = metadata => {
                    const { image, title, description } = metadata ?? {}

                    let markdownContent = `#### [${title || maybeURL}](${maybeURL})\n\n`

                    if (image || description) {
                        markdownContent += '---\n\n'

                        if (image) {
                            markdownContent += `<img height="64" src="${image}" align="left" style="padding-right: 4px;" />`
                        }

                        if (description) {
                            markdownContent += `\n\n${description ?? ''}`
                        }
                    }

                    return {
                        range,
                        contents: {
                            value: markdownContent,
                            kind: sourcegraph.MarkupKind.Markdown,
                        },
                    }
                }

                // yield link-only preview before trying to get metadata
                yield createResult()

                try {
                    const settings = sourcegraph.configuration.get<Settings>().value

                    const response = await fetch(
                        `${
                            settings['linkPreviewExpander.corsAnywhereUrl']?.replace(/\/$/, '') ??
                            'https://cors-anywhere.herokuapp.com'
                        }/${maybeURL}`,
                        { cache: 'force-cache' }
                    )
                    const htmlString = await response.text()

                    yield createResult(getMetadataFromHTMLString(htmlString))
                } catch {
                    // noop. already yielded link w/out metadata
                }
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
