import type { EncodingName } from './encodings.js';

export type Alignment = 'left' | 'center' | 'right';
export type Font = 'a' | 'b' | 'c';
export type UnderlineMode = boolean | 0 | 1 | 2;
export type CutType = 'full' | 'partial';

export interface BuilderOptions {
  /**
   * Text encoding used until changed with `.encoding()`.
   * @default 'cp437'
   */
  encoding?: EncodingName;
  /**
   * Emit ESC @ (initialize printer) as the first command.
   * @default true
   */
  initialize?: boolean;
  /**
   * Line width in half-width character cells, used by layout helpers
   * such as `rule()` and `leftRight()`. Typical values: 48 for 80 mm
   * paper, 32 for 58 mm paper (Font A at 203 dpi).
   * @default 48
   */
  width?: number;
}

export interface TableColumn {
  /**
   * Column width in half-width cells. Exactly one column may omit it
   * to absorb the remaining line width.
   */
  width?: number;
  /** Cell alignment. @default 'left' */
  align?: 'left' | 'center' | 'right';
}

export type QRErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QRCodeOptions {
  /** QR model. @default 2 */
  model?: 1 | 2;
  /** Module size in dots, 1–16. @default 6 */
  size?: number;
  /** Error correction level. @default 'M' */
  errorCorrection?: QRErrorCorrection;
  /**
   * Encoding for the QR payload. Most modern readers expect UTF-8.
   * @default 'utf8'
   */
  encoding?: 'utf8' | EncodingName;
}

export type BarcodeType =
  | 'UPC_A'
  | 'UPC_E'
  | 'EAN13'
  | 'EAN8'
  | 'CODE39'
  | 'ITF'
  | 'CODABAR'
  | 'CODE93'
  | 'CODE128';

export type HriPosition = 'none' | 'above' | 'below' | 'both';

export interface BarcodeOptions {
  /** Bar height in dots, 1–255. @default 80 */
  height?: number;
  /** Module width, 2–6. @default 2 */
  width?: number;
  /** Position of the human-readable text. @default 'none' */
  hriPosition?: HriPosition;
  /** Font of the human-readable text. @default 'a' */
  hriFont?: Font;
}

export interface ImageSource {
  /**
   * Pixel data: RGBA (width * height * 4 bytes, e.g. canvas `ImageData.data`)
   * or 8-bit grayscale (width * height bytes, 0 = black, 255 = white).
   */
  data: Uint8Array | Uint8ClampedArray | number[];
  width: number;
  height: number;
}

export interface ImageOptions {
  /** Dithering algorithm for grayscale conversion. @default 'none' */
  dither?: 'none' | 'floyd-steinberg';
  /** Luminance threshold (0–255) below which a pixel prints black. @default 128 */
  threshold?: number;
}
