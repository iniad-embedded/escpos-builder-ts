import iconv from 'iconv-lite';
import { ESC, GS, HT, INIT, KANJI_OFF, KANJI_ON, LF } from './commands.js';
import { resolveEncoding, type EncodingName } from './encodings.js';
import { toRaster } from './image.js';
import type {
  Alignment,
  BarcodeOptions,
  BarcodeType,
  BuilderOptions,
  CutType,
  Font,
  ImageOptions,
  ImageSource,
  QRCodeOptions,
  UnderlineMode,
} from './types.js';

const ALIGNMENTS: Record<Alignment, number> = { left: 0, center: 1, right: 2 };
const FONTS: Record<Font, number> = { a: 0, b: 1, c: 2 };
const QR_EC_LEVELS = { L: 48, M: 49, Q: 50, H: 51 } as const;
const HRI_POSITIONS = { none: 0, above: 1, below: 2, both: 3 } as const;
// GS k function B barcode type codes.
const BARCODE_TYPES: Record<BarcodeType, number> = {
  UPC_A: 65,
  UPC_E: 66,
  EAN13: 67,
  EAN8: 68,
  CODE39: 69,
  ITF: 70,
  CODABAR: 71,
  CODE93: 72,
  CODE128: 73,
};

function assertRange(value: number, min: number, max: number, what: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${what} must be an integer between ${min} and ${max}, got ${value}`);
  }
}

/**
 * Fluent builder producing a Uint8Array of ESC/POS commands.
 */
export class EscPosBuilder {
  private chunks: number[] = [];
  /** Encoding used for subsequent text. */
  private currentEncoding: EncodingName;
  /** Encoding whose switch commands have been emitted, if any. */
  private appliedEncoding: EncodingName | null = null;
  private kanjiMode = false;

  constructor(options: BuilderOptions = {}) {
    this.currentEncoding = options.encoding ?? 'cp437';
    if (options.initialize !== false) {
      this.push(INIT);
    }
  }

  // --- Output ---

  /** Return the accumulated commands as a Uint8Array. */
  build(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }

  /** Discard all accumulated commands and reset encoding state. */
  clear(): this {
    this.chunks = [];
    this.appliedEncoding = null;
    this.kanjiMode = false;
    return this;
  }

  // --- Text ---

  /**
   * Set the encoding for subsequent text. Code page / Kanji mode switch
   * commands are emitted automatically before the next text output.
   */
  encoding(name: EncodingName): this {
    resolveEncoding(name); // validate eagerly
    this.currentEncoding = name;
    return this;
  }

  /** Print text in the current encoding. */
  text(value: string): this {
    this.ensureEncoding();
    const { def } = resolveEncoding(this.currentEncoding);
    this.push(iconv.encode(value, def.iconv));
    return this;
  }

  /** Print text followed by a line feed. */
  textLine(value: string): this {
    return this.text(value).newline();
  }

  /** Line feed. */
  newline(count = 1): this {
    assertRange(count, 1, 255, 'count');
    for (let i = 0; i < count; i++) this.push([LF]);
    return this;
  }

  /** Horizontal tab. */
  tab(): this {
    return this.push([HT]);
  }

  /** Print and feed n lines (ESC d). */
  feed(lines = 1): this {
    assertRange(lines, 0, 255, 'lines');
    return this.push([ESC, 0x64, lines]);
  }

  // --- Formatting ---

  /** Emphasized (bold) mode (ESC E). */
  bold(enabled = true): this {
    return this.push([ESC, 0x45, enabled ? 1 : 0]);
  }

  /** Underline mode: off / 1-dot / 2-dot (ESC -). */
  underline(mode: UnderlineMode = true): this {
    const n = mode === true ? 1 : mode === false ? 0 : mode;
    return this.push([ESC, 0x2d, n]);
  }

  /** White/black reverse printing (GS B). */
  invert(enabled = true): this {
    return this.push([GS, 0x42, enabled ? 1 : 0]);
  }

  /** Upside-down printing (ESC {). */
  upsideDown(enabled = true): this {
    return this.push([ESC, 0x7b, enabled ? 1 : 0]);
  }

  /** Select character font (ESC M). */
  font(font: Font): this {
    return this.push([ESC, 0x4d, FONTS[font]]);
  }

  /** Text alignment (ESC a). */
  align(alignment: Alignment): this {
    return this.push([ESC, 0x61, ALIGNMENTS[alignment]]);
  }

  /** Character size: width and height magnification, each 1–8 (GS !). */
  size(width: number, height = width): this {
    assertRange(width, 1, 8, 'width');
    assertRange(height, 1, 8, 'height');
    return this.push([GS, 0x21, ((width - 1) << 4) | (height - 1)]);
  }

  /** Set line spacing in dots, or reset to the printer default (ESC 3 / ESC 2). */
  lineSpacing(dots?: number): this {
    if (dots === undefined) return this.push([ESC, 0x32]);
    assertRange(dots, 0, 255, 'dots');
    return this.push([ESC, 0x33, dots]);
  }

  // --- QR code ---

  /** Print a QR code using native GS ( k commands. */
  qrcode(data: string, options: QRCodeOptions = {}): this {
    const model = options.model ?? 2;
    const size = options.size ?? 6;
    const ec = options.errorCorrection ?? 'M';
    assertRange(size, 1, 16, 'size');

    const payload =
      options.encoding === undefined || options.encoding === 'utf8'
        ? Buffer.from(data, 'utf8')
        : iconv.encode(data, resolveEncoding(options.encoding).def.iconv);
    if (payload.length === 0 || payload.length > 7089) {
      throw new RangeError(`QR data must be 1-7089 bytes, got ${payload.length}`);
    }

    // Function 165: select model
    this.push([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, model === 1 ? 49 : 50, 0x00]);
    // Function 167: module size
    this.push([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]);
    // Function 169: error correction level
    this.push([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, QR_EC_LEVELS[ec]]);
    // Function 180: store data
    const len = payload.length + 3;
    this.push([GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30]);
    this.push(payload);
    // Function 181: print
    this.push([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);
    return this;
  }

  // --- Barcode ---

  /** Print a barcode (GS k function B). */
  barcode(data: string, type: BarcodeType, options: BarcodeOptions = {}): this {
    const typeCode = BARCODE_TYPES[type];
    if (typeCode === undefined) {
      throw new RangeError(`Unknown barcode type: ${type}`);
    }
    const height = options.height ?? 80;
    const width = options.width ?? 2;
    assertRange(height, 1, 255, 'height');
    assertRange(width, 2, 6, 'width');

    // CODE128 requires a code-set selector; default to code set B.
    const content = type === 'CODE128' && !data.startsWith('{') ? `{B${data}` : data;
    const bytes = Buffer.from(content, 'ascii');
    assertRange(bytes.length, 1, 255, 'barcode data length');

    this.push([GS, 0x68, height]);
    this.push([GS, 0x77, width]);
    this.push([GS, 0x48, HRI_POSITIONS[options.hriPosition ?? 'none']]);
    this.push([GS, 0x66, FONTS[options.hriFont ?? 'a']]);
    this.push([GS, 0x6b, typeCode, bytes.length]);
    this.push(bytes);
    return this;
  }

  // --- Image ---

  /** Print a raster bit image (GS v 0). */
  image(source: ImageSource, options: ImageOptions = {}): this {
    const raster = toRaster(source, options);
    if (raster.widthBytes > 0xffff || raster.height > 0xffff) {
      throw new RangeError('Image too large for GS v 0');
    }
    this.push([
      GS,
      0x76,
      0x30,
      0x00, // normal mode (no scaling)
      raster.widthBytes & 0xff,
      (raster.widthBytes >> 8) & 0xff,
      raster.height & 0xff,
      (raster.height >> 8) & 0xff,
    ]);
    this.push(raster.data);
    return this;
  }

  // --- Hardware ---

  /** Feed to the cut position and cut the paper (GS V function B). */
  cut(type: CutType = 'full', feed = 0): this {
    assertRange(feed, 0, 255, 'feed');
    return this.push([GS, 0x56, type === 'partial' ? 66 : 65, feed]);
  }

  /** Generate a cash drawer kick-out pulse (ESC p). */
  cashDrawer(pin: 0 | 1 = 0, onMs = 100, offMs = 500): this {
    const on = Math.round(onMs / 2);
    const off = Math.round(offMs / 2);
    assertRange(on, 0, 255, 'onMs / 2');
    assertRange(off, 0, 255, 'offMs / 2');
    return this.push([ESC, 0x70, pin, on, off]);
  }

  /** Initialize the printer (ESC @). */
  init(): this {
    this.appliedEncoding = null;
    this.kanjiMode = false;
    return this.push(INIT);
  }

  // --- Extensibility ---

  /**
   * Append raw bytes verbatim — the escape hatch for vendor- or
   * model-specific commands not covered by this builder.
   */
  custom(data: ArrayLike<number>): this {
    return this.push(data);
  }

  /** Alias of {@link custom}. */
  raw(data: ArrayLike<number>): this {
    return this.custom(data);
  }

  // --- Internals ---

  private push(bytes: ArrayLike<number>): this {
    for (let i = 0; i < bytes.length; i++) {
      this.chunks.push(bytes[i] & 0xff);
    }
    return this;
  }

  /** Emit code page / Kanji mode switches if the encoding changed. */
  private ensureEncoding(): void {
    if (this.appliedEncoding === this.currentEncoding) return;
    const { def } = resolveEncoding(this.currentEncoding);
    if (def.multibyte) {
      if (!this.kanjiMode) {
        this.push(KANJI_ON);
        this.kanjiMode = true;
      }
    } else {
      if (this.kanjiMode || this.appliedEncoding === null) {
        this.push(KANJI_OFF);
        this.kanjiMode = false;
      }
      this.push([ESC, 0x74, def.codepage!]);
    }
    this.appliedEncoding = this.currentEncoding;
  }
}
