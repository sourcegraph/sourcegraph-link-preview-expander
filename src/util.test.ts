import * as assert from 'assert'
import { checkIsURL, cleanURL } from './util'

describe('util', () => {
    describe('checkIsUrl', () => {
        it('returns true for valid URLs', () => {
            assert.strictEqual(checkIsURL('https://sourcegraph.com/extensions'), true)
        })

        it('returns false for invalid URLs', () => {
            assert.strictEqual(checkIsURL('//sourcegraph/extensions'), false)
        })
    })

    describe('cleanURL', () => {
        it('strips last character when it is a period or comma', () => {
            assert.strictEqual(cleanURL('https://sourcegraph.com/extensions,'), 'https://sourcegraph.com/extensions')
        })

        it('does not strip last character when it is not a period or comma', () => {
            assert.strictEqual(cleanURL('https://sourcegraph.com/extensions'), 'https://sourcegraph.com/extensions')
        })
    })
})
