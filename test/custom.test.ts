import { describe, expect, it } from 'vitest';
import { EscPosBuilder } from '../src/index.js';

describe('custom', () => {
  it('appends raw bytes verbatim', () => {
    const bytes = new EscPosBuilder({ initialize: false })
      .custom([0x1b, 0x70, 0x00, 0x19, 0xfa])
      .build();
    expect(bytes).toEqual(Uint8Array.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
  });

  it('accepts Uint8Array input and supports raw() alias', () => {
    const bytes = new EscPosBuilder({ initialize: false })
      .raw(Uint8Array.from([0x10, 0x14, 0x01, 0x00, 0x05]))
      .build();
    expect(bytes).toEqual(Uint8Array.from([0x10, 0x14, 0x01, 0x00, 0x05]));
  });

  it('interleaves with built-in commands in call order', () => {
    const bytes = new EscPosBuilder({ initialize: false })
      .bold()
      .custom([0xaa])
      .bold(false)
      .build();
    expect(bytes).toEqual(Uint8Array.from([0x1b, 0x45, 0x01, 0xaa, 0x1b, 0x45, 0x00]));
  });

  it('supports prototype extension for vendor commands', () => {
    class StarBuilder extends EscPosBuilder {
      openDrawer(): this {
        return this.custom([0x07]);
      }
    }
    const bytes = new StarBuilder({ initialize: false }).openDrawer().build();
    expect(bytes).toEqual(Uint8Array.from([0x07]));
  });
});
