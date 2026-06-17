import { ESC, FS, GS, HT, INIT, KANJI_OFF, KANJI_ON, LF } from './commands.js';
import { resolveEncoding, type EncodingName } from './encodings.js';
import { toRaster } from './image.js';
import { charWidth, stringWidth } from './width.js';
import type {
  Alignment,
  TableColumn,
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

function encodeAscii(value: string, what: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code > 0x7f) {
      throw new RangeError(`${what} must contain only ASCII characters`);
    }
    bytes[i] = code;
  }
  return bytes;
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
  /** Line width in half-width cells, used by layout helpers. */
  readonly width: number;

  constructor(options: BuilderOptions = {}) {
    this.currentEncoding = options.encoding ?? 'cp437';
    this.width = options.width ?? 48;
    assertRange(this.width, 1, 255, 'width');
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
    this.push(resolveEncoding(this.currentEncoding).encode(value));
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

  // --- Layout helpers ---
  // These compose text using the configured line width, counting East
  // Asian wide characters (kanji, kana, hangul, ...) as two cells.

  /** Print a horizontal rule spanning the full line width. */
  rule(char = '-'): this {
    const cell = this.displayWidth(char);
    return this.textLine(char.repeat(Math.floor(this.width / cell)));
  }

  /**
   * Print `left` and `right` on one line, separated by padding so that
   * `right` ends at the right edge — e.g. item name and price.
   * If both sides do not fit, they are separated by a single space.
   */
  leftRight(left: string, right: string, pad = ' '): this {
    const gap = this.width - this.displayWidth(left) - this.displayWidth(right);
    return this.textLine(left + pad.repeat(Math.max(gap, 1)) + right);
  }

  /**
   * Print rows of fixed-width columns. Exactly one column may omit
   * `width` to absorb the remaining line width. Cell content wider than
   * its column is truncated.
   *
   * ```ts
   * b.table(
   *   [{}, { width: 4, align: 'right' }, { width: 8, align: 'right' }],
   *   [['りんご', '2', '¥200'], ['バナナ', '10', '¥500']],
   * );
   * ```
   */
  table(columns: TableColumn[], rows: string[][]): this {
    if (columns.length === 0) {
      throw new RangeError('table requires at least one column');
    }
    const flexible = columns.filter((column) => column.width === undefined).length;
    if (flexible > 1) {
      throw new RangeError('At most one table column may omit width');
    }
    const fixed = columns.reduce((sum, column) => sum + (column.width ?? 0), 0);
    const flexWidth = this.width - fixed;
    if (flexible === 1 && flexWidth < 1) {
      throw new RangeError(
        `Fixed columns occupy ${fixed} cells, leaving no room in a ${this.width}-cell line`,
      );
    }
    const widths = columns.map((column) => column.width ?? flexWidth);
    for (const row of rows) {
      if (row.length !== columns.length) {
        throw new RangeError(`Row has ${row.length} cells, expected ${columns.length}`);
      }
      const line = row
        .map((cell, i) => this.padCell(this.truncateCell(cell, widths[i]), widths[i], columns[i].align))
        .join('');
      this.textLine(line.trimEnd());
    }
    return this;
  }

  /**
   * Display width of a string under the current encoding: East Asian
   * Ambiguous characters (box drawing, ※, ...) are full-width in CJK
   * encodings and half-width elsewhere.
   */
  private displayWidth(value: string): number {
    return stringWidth(value, resolveEncoding(this.currentEncoding).multibyte);
  }

  /** Cut a string so its display width does not exceed `max` cells. */
  private truncateCell(value: string, max: number): string {
    const wide = resolveEncoding(this.currentEncoding).multibyte;
    let out = '';
    let used = 0;
    for (const char of value) {
      const cells = charWidth(char.codePointAt(0)!, wide);
      if (used + cells > max) break;
      out += char;
      used += cells;
    }
    return out;
  }

  private padCell(value: string, width: number, align: TableColumn['align']): string {
    const gap = width - this.displayWidth(value);
    if (gap <= 0) return value;
    if (align === 'right') return ' '.repeat(gap) + value;
    if (align === 'center') {
      return ' '.repeat(Math.floor(gap / 2)) + value + ' '.repeat(Math.ceil(gap / 2));
    }
    return value + ' '.repeat(gap);
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
        ? new TextEncoder().encode(data)
        : resolveEncoding(options.encoding).encode(data);
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
    const bytes = encodeAscii(content, 'barcode data');
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
    const def = resolveEncoding(this.currentEncoding);
    if (def.multibyte) {
      if (!this.kanjiMode) {
        if (def.kanjiCode !== undefined) {
          this.push([FS, 0x43, def.kanjiCode]);
        }
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
