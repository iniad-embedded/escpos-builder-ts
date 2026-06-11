import type { ImageOptions, ImageSource } from './types.js';

export interface Raster {
  /** 1 bit per pixel, MSB first, rows padded to whole bytes. 1 = black. */
  data: Uint8Array;
  /** Bytes per row (ceil(width / 8)). */
  widthBytes: number;
  height: number;
}

/** Convert RGBA or grayscale pixels to luminance (0 = black, 255 = white). */
function toGrayscale(image: ImageSource): Float64Array {
  const { data, width, height } = image;
  const pixels = width * height;
  const gray = new Float64Array(pixels);

  if (data.length === pixels) {
    for (let i = 0; i < pixels; i++) gray[i] = data[i];
  } else if (data.length === pixels * 4) {
    for (let i = 0; i < pixels; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const a = data[i * 4 + 3] / 255;
      // Composite on a white background, then take luminance.
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[i] = lum * a + 255 * (1 - a);
    }
  } else {
    throw new RangeError(
      `Image data length ${data.length} does not match ` +
        `${width}x${height} grayscale (${pixels}) or RGBA (${pixels * 4})`,
    );
  }
  return gray;
}

/**
 * Convert an image to a 1-bpp monochrome raster suitable for GS v 0.
 */
export function toRaster(image: ImageSource, options: ImageOptions = {}): Raster {
  const { width, height } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Invalid image dimensions: ${width}x${height}`);
  }
  const threshold = options.threshold ?? 128;
  const gray = toGrayscale(image);

  if (options.dither === 'floyd-steinberg') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const oldValue = gray[i];
        const newValue = oldValue < threshold ? 0 : 255;
        gray[i] = newValue;
        const error = oldValue - newValue;
        if (x + 1 < width) gray[i + 1] += (error * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) gray[i + width - 1] += (error * 3) / 16;
          gray[i + width] += (error * 5) / 16;
          if (x + 1 < width) gray[i + width + 1] += (error * 1) / 16;
        }
      }
    }
  }

  const widthBytes = Math.ceil(width / 8);
  const raster = new Uint8Array(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < threshold) {
        raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return { data: raster, widthBytes, height };
}
