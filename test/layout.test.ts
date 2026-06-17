import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { EscPosBuilder, stringWidth } from '../src/index.js';

const CP437_SWITCH = [0x1c, 0x2e, 0x1b, 0x74, 0x00];
const KANJI_ON_JP = [0x1c, 0x43, 0x31, 0x1c, 0x26]; // FS C 1 + FS &

describe('stringWidth', () => {
  it.each([
    ['ASCII', 'Hello', 5],
    ['full-width hiragana', 'りんご', 6],
    ['full-width kanji', '合計', 4],
    ['hangul', '안녕', 4],
    ['mixed full/half width', 'A定食B', 6],
    ['full-width forms', 'ＡＢＣ', 6],
    ['half-width katakana', 'ﾘﾝｺ', 3],
    ['empty string', '', 0],
  ])('counts %s', (_name, value, expected) => {
    expect(stringWidth(value)).toBe(expected);
  });

  it('treats East Asian Ambiguous characters as narrow by default, wide on request', () => {
    expect(stringWidth('━※①')).toBe(3);
    expect(stringWidth('━※①', true)).toBe(6);
  });
});

describe('rule', () => {
  it('spans the configured width', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 8 }).rule().build();
    expect(bytes).toEqual(
      Uint8Array.from([...CP437_SWITCH, ...Buffer.from('--------', 'ascii'), 0x0a]),
    );
  });

  it('halves the repeat count for full-width characters', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 8, encoding: 'cp932' })
      .rule('━')
      .build();
    expect(bytes).toEqual(
      Uint8Array.from([...KANJI_ON_JP, ...iconv.encode('━━━━', 'cp932'), 0x0a]),
    );
  });
});

describe('leftRight', () => {
  it('pads ASCII text to the right edge', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 16 })
      .leftRight('Apple', '$1.00')
      .build();
    expect(bytes).toEqual(
      Uint8Array.from([...CP437_SWITCH, ...Buffer.from('Apple      $1.00', 'ascii'), 0x0a]),
    );
  });

  it('counts full-width characters as two cells', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 16, encoding: 'cp932' })
      .leftRight('りんご', '100')
      .build();
    // りんご = 6 cells, 100 = 3 cells → 7 spaces of padding
    expect(bytes).toEqual(
      Uint8Array.from([...KANJI_ON_JP, ...iconv.encode('りんご       100', 'cp932'), 0x0a]),
    );
  });

  it('falls back to a single space when the line overflows', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 8 })
      .leftRight('LongItemName', '$10.00')
      .build();
    expect(bytes).toEqual(
      Uint8Array.from([...CP437_SWITCH, ...Buffer.from('LongItemName $10.00', 'ascii'), 0x0a]),
    );
  });

  it('supports a custom padding character', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 12 })
      .leftRight('Sub', '9', '.')
      .build();
    expect(bytes).toEqual(
      Uint8Array.from([...CP437_SWITCH, ...Buffer.from('Sub........9', 'ascii'), 0x0a]),
    );
  });
});

describe('width option', () => {
  it('defaults to 48 cells', () => {
    expect(new EscPosBuilder({ initialize: false }).width).toBe(48);
  });

  it('rejects invalid widths', () => {
    expect(() => new EscPosBuilder({ width: 0 })).toThrow(RangeError);
  });
});
