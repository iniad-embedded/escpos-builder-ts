import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import big5 from '../src/encodings/big5.js';
import euckr from '../src/encodings/euckr.js';
import gbk from '../src/encodings/gbk.js';
import { availableEncodings, EscPosBuilder, registerEncoding } from '../src/index.js';

registerEncoding(gbk);
registerEncoding(big5);
registerEncoding(euckr);

const KANJI_ON = [0x1c, 0x26];
const KANJI_ON_JP = [0x1c, 0x43, 0x31, 0x1c, 0x26]; // FS C 1 + FS &
const KANJI_OFF = [0x1c, 0x2e];

describe('multi-byte encodings', () => {
  it('prints Japanese text in Kanji mode as CP932', () => {
    const bytes = new EscPosBuilder({ initialize: false, encoding: 'cp932' })
      .text('こんにちは')
      .build();
    const expected = [...KANJI_ON_JP, ...iconv.encode('こんにちは', 'cp932')];
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
    const ascii = [...'ABC 123'].map((c) => c.charCodeAt(0));
    expect(bytes).toEqual(Uint8Array.from([...KANJI_ON_JP, ...ascii]));
  });

  it.each([
    ['gbk', '你好'],
    ['big5', '繁體'],
    ['euckr', '안녕'],
  ] as const)('encodes %s text (registered via subpath module)', (encoding, sample) => {
    const bytes = new EscPosBuilder({ initialize: false, encoding }).text(sample).build();
    const expected = [...KANJI_ON, ...iconv.encode(sample, encoding)];
    expect(bytes).toEqual(Uint8Array.from(expected));
  });

  it('matches iconv-lite across the whole CP932 range', () => {
    let sample = '';
    for (let cp = 0x80; cp <= 0xffff; cp += 17) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue;
      sample += String.fromCharCode(cp);
    }
    const bytes = new EscPosBuilder({ initialize: false, encoding: 'cp932' })
      .text(sample)
      .build();
    expect(bytes).toEqual(Uint8Array.from([...KANJI_ON_JP, ...iconv.encode(sample, 'cp932')]));
  });

  it('replaces unmappable characters with "?"', () => {
    const bytes = new EscPosBuilder({ initialize: false, encoding: 'cp932' })
      .text('A\u{1F600}B') // astral emoji is not representable in CP932
      .build();
    expect(bytes).toEqual(Uint8Array.from([...KANJI_ON_JP, 0x41, 0x3f, 0x42]));
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
      ...iconv.encode(sample, encoding),
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
      ...[...'Total'].map((c) => c.charCodeAt(0)),
      ...KANJI_ON_JP,
      ...iconv.encode('合計', 'cp932'),
      ...iconv.encode('です', 'cp932'), // no second switch
      ...KANJI_OFF, 0x1b, 0x74, 0, // back to cp437
      0x21,
    ];
    expect(bytes).toEqual(Uint8Array.from(expected));
  });

  it('rejects unknown encodings eagerly', () => {
    const builder = new EscPosBuilder({ initialize: false });
    expect(() => builder.encoding('klingon')).toThrow(RangeError);
  });
});

describe('registerEncoding', () => {
  it('accepts a custom encoder function', () => {
    registerEncoding({
      name: 'rot-test',
      codepage: 7,
      encode: (text) => Uint8Array.from([...text].map((c) => c.charCodeAt(0) + 1)),
    });
    expect(availableEncodings()).toContain('rot-test');
    const bytes = new EscPosBuilder({ initialize: false, encoding: 'rot-test' })
      .text('AB')
      .build();
    expect(bytes).toEqual(Uint8Array.from([0x1c, 0x2e, 0x1b, 0x74, 7, 0x42, 0x43]));
  });

  it('rejects definitions without table or encoder', () => {
    expect(() => registerEncoding({ name: 'empty', codepage: 1 })).toThrow(TypeError);
  });
});
