import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { EscPosBuilder } from '../src/index.js';

const CP437_SWITCH = [0x1c, 0x2e, 0x1b, 0x74, 0x00];
const KANJI_ON = [0x1c, 0x26];

function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}

describe('table', () => {
  it('lays out a flexible column with right-aligned fixed columns', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 20 })
      .table(
        [{}, { width: 4, align: 'right' }, { width: 8, align: 'right' }],
        [
          ['Apple', '2', '300'],
          ['Banana', '10', '1,250'],
        ],
      )
      .build();
    expect(bytes).toEqual(
      Uint8Array.from([
        ...CP437_SWITCH,
        ...ascii('Apple      2     300'), 0x0a,
        ...ascii('Banana    10   1,250'), 0x0a,
      ]),
    );
  });

  it('truncates cell content that exceeds the column width', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 8 })
      .table([{ width: 4 }, { width: 4, align: 'right' }], [['ABCDEFG', '12']])
      .build();
    expect(bytes).toEqual(Uint8Array.from([...CP437_SWITCH, ...ascii('ABCD  12'), 0x0a]));
  });

  it('truncates full-width text at cell boundaries without splitting characters', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 10, encoding: 'cp932' })
      .table([{ width: 5 }, { width: 5, align: 'right' }], [['あいうえ', '12']])
      .build();
    // 'あいうえ' (8 cells) → 'あい' (4 cells; 'う' would overflow the 5-cell column)
    expect(bytes).toEqual(
      Uint8Array.from([...KANJI_ON, ...iconv.encode('あい    12', 'cp932'), 0x0a]),
    );
  });

  it('centers cell content', () => {
    const bytes = new EscPosBuilder({ initialize: false, width: 10 })
      .table([{ align: 'center' }], [['AB']])
      .build();
    expect(bytes).toEqual(Uint8Array.from([...CP437_SWITCH, ...ascii('    AB'), 0x0a]));
  });

  it('rejects more than one flexible column', () => {
    const builder = new EscPosBuilder({ initialize: false });
    expect(() => builder.table([{}, {}], [['a', 'b']])).toThrow(RangeError);
  });

  it('rejects rows whose cell count does not match the columns', () => {
    const builder = new EscPosBuilder({ initialize: false });
    expect(() => builder.table([{ width: 4 }, {}], [['only-one']])).toThrow(RangeError);
  });

  it('rejects fixed columns that leave no room for the flexible one', () => {
    const builder = new EscPosBuilder({ initialize: false, width: 10 });
    expect(() => builder.table([{ width: 10 }, {}], [['a', 'b']])).toThrow(RangeError);
  });
});
