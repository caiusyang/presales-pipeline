import { describe, expect, it } from 'vitest'
import { DICT_KINDS } from './dictKinds'

describe('dictionary management categories', () => {
  it('only exposes dictionaries used by project controls', () => {
    expect(DICT_KINDS.map((kind) => kind.value)).toEqual(['track', 'industry', 'solution'])
  })
})
