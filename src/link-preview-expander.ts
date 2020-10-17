import * as sourcegraph from 'sourcegraph'
import { concat, of } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'
import { catchError, map, switchMap } from 'rxjs/operators'
import { checkIsURL, getWord } from './util'

export function activate(context: sourcegraph.ExtensionContext): void {
    context.subscriptions.add(
        sourcegraph.languages.registerHoverProvider(['*'], {
            provideHover: (document, position) => {
                const range = document.getWordRangeAtPosition(position)
                if (!range) {
                    return null
                }
                const maybeURL = getWord(document, range)
                const isURL = checkIsURL(maybeURL)

                if (!isURL) {
                    return null
                }

                const createResult: (debugString: string) => sourcegraph.Badged<sourcegraph.Hover> = (
                    debugString: string
                ) => ({
                    contents: {
                        value: `<p>${debugString}</p>
                        <a href="${maybeURL}" target="_blank" rel="noopener noreferrer">Navigate to link</a>
                        <img width="64" src="https://miro.medium.com/max/816/1*mn6bOs7s6Qbao15PMNRyOA.png" />`,
                        kind: sourcegraph.MarkupKind.Markdown,
                    },
                })

                return concat(
                    of(createResult('loading')),
                    fromFetch(maybeURL).pipe(
                        switchMap(response => response.text()),
                        map(() => {
                            console.time('parsing + merging')

                            console.timeEnd('parsing + merging')

                            return createResult('loaded')
                        }),
                        catchError(() => of(createResult('error')))
                    )
                )
            },
        })
    )
}

const metadataAttributes = ['image', 'title', 'description'] as const
type MetadataAttributes = typeof metadataAttributes[number]

type Metadata = Record<MetadataAttributes, string>

interface MetadataProvider<T = string> {
    type: T
    selectorType: 'property' | 'name'
    selectorPrefix: string
}

type MetadataProviderType = 'openGraph' | 'twitter'

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

function mergeMetadataProviders(metadataByProvider: Record<MetadataProviderType, Metadata>): Metadata {
    const finalMetadata: Metadata = {
        image: '',
        title: '',
        description: ''
    }

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

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
