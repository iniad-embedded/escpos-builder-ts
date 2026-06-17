import { describe, expect, it } from 'vitest';
import { EscPosBuilder, cropImage, splitImage, toRaster } from '../src/index.js';

/** Build an RGBA buffer from a row-major array of luminance values. */
function rgba(pixels: number[]): Uint8Array {
  const data = new Uint8Array(pixels.length * 4);
  pixels.forEach((value, i) => {
    data[i * 4] = value;
    data[i * 4 + 1] = value;
    data[i * 4 + 2] = value;
    data[i * 4 + 3] = 255;
  });
  return data;
}

describe('toRaster', () => {
  it('converts an 8x2 black/white RGBA image to packed bits', () => {
    const image = {
      data: rgba([...Array(8).fill(0), ...Array(8).fill(255)]),
      width: 8,
      height: 2,
    };
    const raster = toRaster(image);
    expect(raster.widthBytes).toBe(1);
    expect(raster.height).toBe(2);
    expect(raster.data).toEqual(Uint8Array.from([0xff, 0x00]));
  });

  it('pads rows that are not a multiple of 8 pixels', () => {
    const image = { data: rgba(Array(10).fill(0)), width: 10, height: 1 };
    const raster = toRaster(image);
    expect(raster.widthBytes).toBe(2);
    expect(raster.data).toEqual(Uint8Array.from([0xff, 0xc0]));
  });

  it('accepts 8-bit grayscale input', () => {
    const raster = toRaster({ data: [0, 255, 0, 255, 0, 255, 0, 255], width: 8, height: 1 });
    expect(raster.data).toEqual(Uint8Array.from([0b10101010]));
  });

  it('treats transparent pixels as white', () => {
    const data = new Uint8Array(4 * 4); // 4 fully transparent black pixels
    const raster = toRaster({ data, width: 4, height: 1 });
    expect(raster.data).toEqual(Uint8Array.from([0x00]));
  });

  it('approximates mid-gray with ~50% black pixels under Floyd-Steinberg', () => {
    const size = 16;
    const raster = toRaster(
      { data: new Array(size * size).fill(128), width: size, height: size },
      { dither: 'floyd-steinberg' },
    );
    let black = 0;
    for (const byte of raster.data) black += byte.toString(2).split('1').length - 1;
    const ratio = black / (size * size);
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it('rejects mismatched data lengths', () => {
    expect(() => toRaster({ data: new Uint8Array(5), width: 8, height: 1 })).toThrow(RangeError);
  });
});

describe('cropImage', () => {
  it('extracts the specified rows from an RGBA image', () => {
    // 3 rows of 4 pixels: black, white, black
    const data = rgba([...Array(4).fill(0), ...Array(4).fill(255), ...Array(4).fill(0)]);
    const source = { data, width: 4, height: 3 };
    const cropped = cropImage(source, 1, 1);
    expect(cropped.width).toBe(4);
    expect(cropped.height).toBe(1);
    expect(Array.from(cropped.data)).toEqual(Array.from(rgba(Array(4).fill(255))));
  });

  it('extracts rows from a grayscale image', () => {
    const gray = new Uint8Array([0, 0, 255, 255, 0, 0]);
    const cropped = cropImage({ data: gray, width: 2, height: 3 }, 1, 1);
    expect(cropped.height).toBe(1);
    expect(Array.from(cropped.data)).toEqual([255, 255]);
  });

  it('throws on out-of-range top', () => {
    const src = { data: new Uint8Array(8), width: 4, height: 2 };
    expect(() => cropImage(src, 3, 1)).toThrow(RangeError);
  });

  it('throws on out-of-range height', () => {
    const src = { data: new Uint8Array(8), width: 4, height: 2 };
    expect(() => cropImage(src, 0, 3)).toThrow(RangeError);
  });
});

describe('splitImage', () => {
  function makeSource(width: number, height: number): ImageSource {
    return { data: new Uint8Array(width * height * 4), width, height };
  }

  it('splits at 50% by default, aligned to 8 pixels', () => {
    const src = makeSource(8, 32);
    const [top, bottom] = splitImage(src);
    expect(top.height).toBe(16);
    expect(bottom.height).toBe(16);
    expect(top.height + bottom.height).toBe(32);
  });

  it('respects a custom ratio', () => {
    const src = makeSource(8, 32);
    const [top, bottom] = splitImage(src, 0.25);
    expect(top.height).toBe(8);
    expect(bottom.height).toBe(24);
  });

  it('clamps split so each half is at least 8 rows', () => {
    const src = makeSource(8, 16);
    const [top, bottom] = splitImage(src, 0.1); // would be 1.6 → rounds to 0, clamps to 8
    expect(top.height).toBe(8);
    expect(bottom.height).toBe(8);
  });

  it('throws when image is too small to split', () => {
    expect(() => splitImage(makeSource(8, 15))).toThrow(RangeError);
  });

  it('throws on out-of-range ratio', () => {
    const src = makeSource(8, 32);
    expect(() => splitImage(src, 0)).toThrow(RangeError);
    expect(() => splitImage(src, 1)).toThrow(RangeError);
  });
});


describe('builder.image', () => {
  it('emits a GS v 0 header followed by raster data', () => {
    const image = { data: rgba(Array(8).fill(0)), width: 8, height: 1 };
    const bytes = new EscPosBuilder({ initialize: false }).image(image).build();
    expect(bytes).toEqual(
      Uint8Array.from([0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x01, 0x00, 0xff]),
    );
  });
});
