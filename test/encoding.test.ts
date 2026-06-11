import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { EscPosBuilder, resolveEncoding } from '../src/index.js';

const KANJI_ON = [0x1c, 0x26];
const KANJI_OFF = [0x1c, 0x2e];

describe('multi-byte encodings', () => {
  it('prints Japanese text in Kanji mode as CP932', () => {
    const bytes = new EscPosBuilder({ initialize: false, encoding: 'cp932' })
      .text('こんにちは')
      .build();
    const expected = [...KANJI_ON, ...iconv.encode('こんにちは', 'cp932')];
    expect(bytes).toEqual(Uint8Array.from(expected));
  });

  it('accepts the shiftjis / japanese aliases', () => {
    const a = new EscPosBuilder({ initialize: false, encoding: 'shiftjis' }).text('縦').build();
    const b = new EscPosBuilder({ initialize: false, encoding: 'japanese' }).text('縦').build();
    const c = new EscPosBuilder({ initialize: false, encoding: 'cp932' }).text('縦').build();
    expect(a).toEqual(c);
    expect(b).toEqual(c);
  });

  it('passes ASCII through unchanged in Kanji mode', () => {
    const bytes = new EscPosBuilder({ initialize: false, encoding: 'cp932' })
      .text('ABC 123')
      .build();
    expect(bytes).toEqual(Uint8Array.from([...KANJI_ON, ...Buffer.from('ABC 123', 'ascii')]));
  });

  it.each([
    ['gb18030', '你好'],
    ['big5', '繁體'],
    ['euckr', '안녕'],
  ] as const)('encodes %s text', (encoding, sample) => {
    const bytes = new EscPosBuilder({ initialize: false, encoding }).text(sample).build();
    const expected = [...KANJI_ON, ...iconv.encode(sample, resolveEncoding(encoding).def.iconv)];
    expect(bytes).toEqual(Uint8Array.from(expected));
  });
});

describe('single-byte encodings', () => {
  it.each([
    ['cp1252', 'Üñé', 16],
    ['cp866', 'Привет', 17],
    ['cp1253', 'Γειά', 47],
  ] as const)('switches to %s with ESC t', (encoding, sample, codepage) => {
    const bytes = new EscPosBuilder({ initialize: false, encoding }).text(sample).build();
    const expected = [
      ...KANJI_OFF,
      0x1b,
      0x74,
      codepage,
      ...iconv.encode(sample, resolveEncoding(encoding).def.iconv),
    ];
    expect(bytes).toEqual(Uint8Array.from(expected));
  });
});

describe('encoding switches mid-stream', () => {
  it('emits switch commands only when the encoding changes', () => {
    const bytes = new EscPosBuilder({ initialize: false })
      .text('Total')
      .encoding('cp932')
      .text('合計')
      .text('です')
      .encoding('cp437')
      .text('!')
      .build();
    const expected = [
      ...KANJI_OFF, 0x1b, 0x74, 0, // initial cp437
      ...Buffer.from('Total', 'ascii'),
      ...KANJI_ON,
      ...iconv.encode('合計', 'cp932'),
      ...iconv.encode('です', 'cp932'), // no second switch
      ...KANJI_OFF, 0x1b, 0x74, 0, // back to cp437
      0x21,
    ];
    expect(bytes).toEqual(Uint8Array.from(expected));
  });

  it('rejects unknown encodings eagerly', () => {
    const builder = new EscPosBuilder({ initialize: false });
    // @ts-expect-error — intentionally invalid name
    expect(() => builder.encoding('klingon')).toThrow(RangeError);
  });
});
