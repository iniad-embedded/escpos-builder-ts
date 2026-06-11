import { describe, expect, it } from 'vitest';
import { EscPosBuilder } from '../src/index.js';

describe('qrcode', () => {
  it('emits model, size, error correction, store, and print commands', () => {
    const bytes = new EscPosBuilder({ initialize: false }).qrcode('AB').build();
    expect(bytes).toEqual(
      Uint8Array.from([
        0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 50, 0x00, // model 2
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 6, // module size 6
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 49, // EC level M
        0x1d, 0x28, 0x6b, 5, 0, 0x31, 0x50, 0x30, 0x41, 0x42, // store "AB"
        0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30, // print
      ]),
    );
  });

  it('honors size, model, and error correction options', () => {
    const bytes = new EscPosBuilder({ initialize: false })
      .qrcode('X', { model: 1, size: 10, errorCorrection: 'H' })
      .build();
    expect(Array.from(bytes)).toEqual(
      expect.arrayContaining([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 49, 0x00]),
    );
    expect(Array.from(bytes.slice(9, 17))).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 10]);
    expect(Array.from(bytes.slice(17, 25))).toEqual([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 51]);
  });

  it('encodes the payload as UTF-8 by default', () => {
    const bytes = new EscPosBuilder({ initialize: false }).qrcode('日').build();
    const payload = Buffer.from('日', 'utf8');
    const len = payload.length + 3;
    const store = [0x1d, 0x28, 0x6b, len, 0, 0x31, 0x50, 0x30, ...payload];
    expect(Array.from(bytes).join(',')).toContain(store.join(','));
  });

  it('computes a two-byte length for long payloads', () => {
    const data = 'a'.repeat(300);
    const bytes = new EscPosBuilder({ initialize: false }).qrcode(data).build();
    const len = 300 + 3; // 303 = 0x012F
    const idx = Array.from(bytes).join(',').indexOf([0x1d, 0x28, 0x6b, len & 0xff, 1].join(','));
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it('rejects empty and oversized payloads', () => {
    const builder = new EscPosBuilder({ initialize: false });
    expect(() => builder.qrcode('')).toThrow(RangeError);
    expect(() => builder.qrcode('a'.repeat(8000))).toThrow(RangeError);
  });
});
