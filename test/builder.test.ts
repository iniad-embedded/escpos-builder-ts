import { describe, expect, it } from 'vitest';
import { EscPosBuilder } from '../src/index.js';

// FS . + ESC t 0 — emitted before the first single-byte text output.
const CP437_SWITCH = [0x1c, 0x2e, 0x1b, 0x74, 0x00];

describe('EscPosBuilder', () => {
  it('emits ESC @ on construction by default', () => {
    expect(new EscPosBuilder().build()).toEqual(Uint8Array.from([0x1b, 0x40]));
  });

  it('skips initialization when initialize: false', () => {
    expect(new EscPosBuilder({ initialize: false }).build()).toEqual(Uint8Array.from([]));
  });

  it('encodes ASCII text after switching to the code page', () => {
    const bytes = new EscPosBuilder({ initialize: false }).text('Hi').build();
    expect(bytes).toEqual(Uint8Array.from([...CP437_SWITCH, 0x48, 0x69]));
  });

  it('does not repeat the code page switch for consecutive text', () => {
    const bytes = new EscPosBuilder({ initialize: false }).text('A').text('B').build();
    expect(bytes).toEqual(Uint8Array.from([...CP437_SWITCH, 0x41, 0x42]));
  });

  it('appends LF for textLine', () => {
    const bytes = new EscPosBuilder({ initialize: false }).textLine('A').build();
    expect(bytes).toEqual(Uint8Array.from([...CP437_SWITCH, 0x41, 0x0a]));
  });

  it.each([
    ['bold on', (b: EscPosBuilder) => b.bold(), [0x1b, 0x45, 0x01]],
    ['bold off', (b: EscPosBuilder) => b.bold(false), [0x1b, 0x45, 0x00]],
    ['underline single', (b: EscPosBuilder) => b.underline(), [0x1b, 0x2d, 0x01]],
    ['underline double', (b: EscPosBuilder) => b.underline(2), [0x1b, 0x2d, 0x02]],
    ['invert', (b: EscPosBuilder) => b.invert(), [0x1d, 0x42, 0x01]],
    ['upside down', (b: EscPosBuilder) => b.upsideDown(), [0x1b, 0x7b, 0x01]],
    ['font b', (b: EscPosBuilder) => b.font('b'), [0x1b, 0x4d, 0x01]],
    ['align center', (b: EscPosBuilder) => b.align('center'), [0x1b, 0x61, 0x01]],
    ['align right', (b: EscPosBuilder) => b.align('right'), [0x1b, 0x61, 0x02]],
    ['size 2x2', (b: EscPosBuilder) => b.size(2), [0x1d, 0x21, 0x11]],
    ['size 1x8', (b: EscPosBuilder) => b.size(1, 8), [0x1d, 0x21, 0x07]],
    ['line spacing 30', (b: EscPosBuilder) => b.lineSpacing(30), [0x1b, 0x33, 30]],
    ['line spacing default', (b: EscPosBuilder) => b.lineSpacing(), [0x1b, 0x32]],
    ['feed 3', (b: EscPosBuilder) => b.feed(3), [0x1b, 0x64, 0x03]],
    ['newline', (b: EscPosBuilder) => b.newline(), [0x0a]],
    ['tab', (b: EscPosBuilder) => b.tab(), [0x09]],
    ['full cut (no feed)', (b: EscPosBuilder) => b.cut(), [0x1d, 0x56, 0x00]],
    ['partial cut (no feed)', (b: EscPosBuilder) => b.cut('partial'), [0x1d, 0x56, 0x01]],
    ['full cut feed 3', (b: EscPosBuilder) => b.cut('full', 3), [0x1d, 0x56, 65, 0x03]],
    ['partial cut feed 3', (b: EscPosBuilder) => b.cut('partial', 3), [0x1d, 0x56, 66, 0x03]],
    ['cash drawer', (b: EscPosBuilder) => b.cashDrawer(), [0x1b, 0x70, 0x00, 50, 250]],
  ])('emits correct bytes for %s', (_name, apply, expected) => {
    const builder = new EscPosBuilder({ initialize: false });
    apply(builder);
    expect(builder.build()).toEqual(Uint8Array.from(expected));
  });

  it('rejects out-of-range character sizes', () => {
    const builder = new EscPosBuilder({ initialize: false });
    expect(() => builder.size(0)).toThrow(RangeError);
    expect(() => builder.size(9)).toThrow(RangeError);
  });

  it('clear() empties the buffer', () => {
    const builder = new EscPosBuilder({ initialize: false }).text('A');
    expect(builder.clear().build()).toEqual(Uint8Array.from([]));
  });

  it('supports chaining', () => {
    const bytes = new EscPosBuilder().align('center').bold().textLine('X').cut().build();
    expect(bytes.length).toBeGreaterThan(0);
  });
});

describe('barcode', () => {
  it('emits settings followed by GS k function B', () => {
    const bytes = new EscPosBuilder({ initialize: false })
      .barcode('4901234567894', 'EAN13', { height: 100, width: 3, hriPosition: 'below' })
      .build();
    const data = [...'4901234567894'].map((c) => c.charCodeAt(0));
    expect(bytes).toEqual(
      Uint8Array.from([
        0x1d, 0x68, 100, // height
        0x1d, 0x77, 3, // width
        0x1d, 0x48, 2, // HRI below
        0x1d, 0x66, 0, // HRI font A
        0x1d, 0x6b, 67, data.length, // EAN13, function B
        ...data,
      ]),
    );
  });

  it('prefixes CODE128 data with the code set B selector', () => {
    const bytes = new EscPosBuilder({ initialize: false }).barcode('Hi', 'CODE128').build();
    // ... GS k <CODE128> <len=4> '{' 'B' 'H' 'i'
    expect(Array.from(bytes.slice(-8))).toEqual([0x1d, 0x6b, 73, 4, 0x7b, 0x42, 0x48, 0x69]);
  });

  it('escapes literal CODE128 braces when adding the code set B selector', () => {
    const bytes = new EscPosBuilder({ initialize: false }).barcode('A{B', 'CODE128').build();
    expect(Array.from(bytes.slice(-10))).toEqual([
      0x1d, 0x6b, 73, 6, 0x7b, 0x42, 0x41, 0x7b, 0x7b, 0x42,
    ]);
  });

  it.each([
    ['UPC_A', '12345'],
    ['EAN13', 'ABCDEFGHIJKLM'],
    ['EAN8', '123456'],
    ['ITF', '123'],
    ['CODE39', 'abc'],
    ['CODABAR', '1234'],
    ['CODE128', '{Z123'],
  ] as const)('rejects invalid %s data', (type, data) => {
    expect(() => new EscPosBuilder({ initialize: false }).barcode(data, type)).toThrow(RangeError);
  });
});
