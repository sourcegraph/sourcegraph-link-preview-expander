import * as sourcegraph from 'sourcegraph'
import { concat, of } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'
import { catchError, map, switchMap } from 'rxjs/operators'

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
                        switchMap(response => {
                            if (response.ok) {
                                return response.json()
                            }
                            return of(createResult('error'))
                        }),
                        map(() => createResult('loaded')),
                        catchError(() => of(createResult('error')))
                    )
                )
            },
        })
    )
}

function getWord(document: sourcegraph.TextDocument, range: sourcegraph.Range): string {
    const lines = document.text?.split('\n')
    let word = ''
    if (lines && range) {
        word = lines[range.start.line].slice(range.start.character, range.end.character)
    }
    return word
}

function checkIsURL(maybeURL: string): boolean {
    try {
        const url = new URL(maybeURL)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

// Sourcegraph extension documentation: https://docs.sourcegraph.com/extensions/authoring
