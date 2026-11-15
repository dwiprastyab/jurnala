import { describe, expect, it } from 'vitest'
import { format, parse } from '../src/md'

describe('limited markdown', () => {
  it('round-trips text that looks like markup', () => {
    for (const s of ['plain', '**bold** and *italic*', '- one\n- two', '3. x\n4. y', '\\- not a bullet', '1\\. not a number', '2 \\* 3 = 6', 'a\\\\b', 'line\n\nline']) {
      expect(format(parse(s))).toBe(s)
    }
  })
  it('never produces html', () => {
    expect(parse('<b>x</b>')[0].segs).toEqual([{ t: '<b>x</b>' }])
  })
  it('reads lists and styles', () => {
    expect(parse('2. a')[0]).toMatchObject({ k: 'ol', n: 2 })
    expect(parse('**a***b*')[0].segs).toEqual([{ t: 'a', b: true }, { t: 'b', i: true }])
  })
})
