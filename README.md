# escpos-builder-ts

[日本語版 README はこちら / Japanese README](./README.ja.md)

> **Work in progress** — this package is under active development. The API may change without notice until v1.0.0.

A fluent, dependency-light ESC/POS command builder for thermal receipt printers, written in TypeScript.

- **Fluent API** — chain text, formatting, QR codes, barcodes, images, and cuts
- **Multi-language** — Japanese (Shift_JIS/CP932), Simplified/Traditional Chinese, Korean, and 20+ single-byte code pages (Western/Central European, Cyrillic, Greek, Turkish, Hebrew, Arabic, Vietnamese, …) with automatic code page / Kanji mode switching
- **QR codes** — native `GS ( k` commands (model, module size, error correction)
- **Images** — RGBA (canvas `ImageData`) or grayscale input, threshold or Floyd–Steinberg dithering, `GS v 0` raster output
- **Barcodes** — UPC-A/E, EAN-13/8, CODE39, ITF, CODABAR, CODE93, CODE128
- **Vendor commands** — `.custom(bytes)` escape hatch for model-specific commands
- **Zero runtime dependencies** — pure TypeScript with bundled encoding tables; runs in Node.js, browsers (Web Bluetooth / WebUSB / WebSerial), Deno, and Bun
- Fully typed, tested with Vitest, ESM + CJS dual package

## Installation

```sh
npm install escpos-builder-ts
```

Works in Node.js ≥ 18 and modern browsers — no Buffer or other Node polyfills needed.

## Quick start

```ts
import { EscPosBuilder } from 'escpos-builder-ts';

const data = new EscPosBuilder()
  .align('center')
  .size(2, 2)
  .textLine('RECEIPT')
  .size(1, 1)
  .align('left')
  .textLine('Apple        $1.00')
  .textLine('Banana       $0.50')
  .bold()
  .textLine('Total        $1.50')
  .bold(false)
  .align('center')
  .qrcode('https://example.com/receipt/123')
  .feed(3)
  .cut()
  .build(); // Uint8Array — send it to your printer (USB, TCP 9100, Bluetooth, ...)
```

The builder only produces bytes; transport is up to you. For example, over a network socket:

```ts
import { createConnection } from 'node:net';

const socket = createConnection(9100, '192.168.1.50', () => {
  socket.end(data);
});
```

## Paper width and receipt layout

Paper width is a physical property of the printer — ESC/POS has no command to set it. Tell the builder how many half-width characters fit on one line (`48` for 80 mm paper, `32` for 58 mm paper with Font A at 203 dpi — check your printer manual), and use the layout helpers:

```ts
const b = new EscPosBuilder({ encoding: 'japanese', width: 32 }); // 58 mm

b.rule()                       // --------------------------------
 .leftRight('りんご', '¥100')   // りんご                     ¥100
 .leftRight('バナナ', '¥50')
 .rule('=')
 .leftRight('合計', '¥150');
```

For multi-column item lines, `table()` takes column definitions (exactly one column may omit `width` to absorb the rest of the line; overlong cells are truncated):

```ts
b.table(
  [{}, { width: 4, align: 'right' }, { width: 8, align: 'right' }],
  [
    ['りんご', '2', '¥200'],
    ['バナナ', '10', '¥500'],
  ],
);
```

`leftRight()`, `table()`, and `rule()` measure display width correctly for mixed scripts: CJK characters count as 2 cells, halfwidth katakana as 1, and East Asian *Ambiguous* characters (box drawing `━`, `※`, `①`, …) as 2 in CJK encodings and 1 elsewhere. The measurement function is exported as `stringWidth(value, ambiguousAsWide?)`.

For images, keep `width` at or below the printable dot count (384 dots for 58 mm, 512–576 for 80 mm). To shrink the printable area itself, the left margin (`GS L`) and print area width (`GS W`) commands can be sent via `.custom()`.

## Multi-language text

Pass an encoding at construction or switch mid-stream with `.encoding()`. Code page (`ESC t`) and Kanji mode (`FS &` / `FS .`) commands are inserted automatically and only when the encoding actually changes.

```ts
import { EscPosBuilder, registerEncoding } from 'escpos-builder-ts';
import gbk from 'escpos-builder-ts/encodings/gbk';

registerEncoding(gbk); // Chinese / Korean are opt-in to keep bundles small

const data = new EscPosBuilder({ encoding: 'japanese' })
  .textLine('いらっしゃいませ')   // CP932 (Shift_JIS) in Kanji mode
  .encoding('cp437')
  .textLine('Thank you!')
  .encoding('gbk')
  .textLine('谢谢')
  .build();
```

### Supported encodings

| Name | Language / region | Mechanism |
| --- | --- | --- |
| `cp932` (`shiftjis`, `japanese`) | Japanese | Kanji mode, Shift_JIS |
| `gbk` (`gb2312`)² | Simplified Chinese | Kanji mode |
| `big5`² | Traditional Chinese | Kanji mode |
| `euckr` (`cp949`, `korean`)² | Korean | Kanji mode |
| `cp437` (`ascii`) | USA / Standard Europe | `ESC t 0` |
| `cp850`, `cp858`, `cp1252` (`latin1`), `iso885915` | Western Europe | `ESC t` |
| `cp852`, `cp1250`, `iso88592` | Central Europe | `ESC t` |
| `cp866`, `cp1251` | Cyrillic | `ESC t` |
| `cp1253` | Greek | `ESC t` |
| `cp1254` | Turkish | `ESC t` |
| `cp1255` | Hebrew¹ | `ESC t` |
| `cp1256` | Arabic¹ | `ESC t` |
| `cp1257` | Baltic | `ESC t` |
| `cp1258` | Vietnamese | `ESC t` |
| `cp860`, `cp863`, `cp865` | Portuguese / Canadian French / Nordic | `ESC t` |

¹ Right-to-left shaping is not performed; the printer prints code points in the order given.
² Shipped as a subpath module to keep browser bundles small — import it (`escpos-builder-ts/encodings/gbk`, `.../big5`, `.../euckr`) and pass it to `registerEncoding()` once at startup. Japanese (`cp932`) and all single-byte code pages are built in. You can also register your own code pages or encoders with `registerEncoding()`.

> **Note** — multi-byte languages require a printer model with the corresponding character set installed (e.g. Japanese models for CP932). Code page numbers follow the Epson standard; for other vendors, check your printer manual and use `.custom()` if a different `ESC t` value is needed.

## QR codes

```ts
builder.qrcode('https://example.com', {
  model: 2,              // 1 | 2 (default 2)
  size: 6,               // module size 1–16 (default 6)
  errorCorrection: 'M',  // 'L' | 'M' | 'Q' | 'H' (default 'M')
  encoding: 'utf8',      // payload encoding (default UTF-8)
});
```

## Images

Accepts RGBA pixels (e.g. canvas `ImageData`) or 8-bit grayscale, and prints via `GS v 0`:

```ts
// In a browser / with node-canvas:
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
builder.image(imageData, { dither: 'floyd-steinberg' });

// Or grayscale bytes (0 = black, 255 = white):
builder.image({ data: grayPixels, width: 384, height: 200 }, { threshold: 128 });
```

To print PNG/JPEG files in Node.js, decode them first with a library such as [`sharp`](https://github.com/lovell/sharp) or [`jimp`](https://github.com/jimp-dev/jimp) and pass the raw pixels.

## Barcodes

```ts
builder.barcode('4901234567894', 'EAN13', {
  height: 80,           // dots, 1–255
  width: 2,             // module width, 2–6
  hriPosition: 'below', // 'none' | 'above' | 'below' | 'both'
  hriFont: 'a',
});
```

## Vendor-specific commands

Every printer family has extensions beyond standard ESC/POS. Use `.custom()` (alias `.raw()`) to insert raw bytes anywhere in the chain:

```ts
builder
  .textLine('Hello')
  .custom([0x1b, 0x70, 0x00, 0x19, 0xfa]) // e.g. drawer kick
  .cut();
```

For reusable model-specific commands, extend the builder:

```ts
import { EscPosBuilder } from 'escpos-builder-ts';

class MyPrinterBuilder extends EscPosBuilder {
  buzzer(times = 1): this {
    return this.custom([0x1b, 0x42, times, 0x02]);
  }
}

new MyPrinterBuilder().textLine('Order ready').buzzer(3).cut().build();
```

## API reference

| Method | ESC/POS | Description |
| --- | --- | --- |
| `text(s)` / `textLine(s)` | — | Print text (in the current encoding) |
| `rule(char?)` | — | Horizontal rule spanning the line width |
| `leftRight(left, right, pad?)` | — | Left- and right-aligned text on one line |
| `table(columns, rows)` | — | Fixed-width columns with per-column alignment |
| `encoding(name)` | `ESC t` / `FS &` | Switch text encoding |
| `newline(n?)` / `tab()` / `feed(n?)` | `LF` / `HT` / `ESC d` | Whitespace and feeding |
| `bold(on?)` | `ESC E` | Emphasized mode |
| `underline(mode?)` | `ESC -` | Underline (off / 1-dot / 2-dot) |
| `invert(on?)` | `GS B` | White/black reverse |
| `upsideDown(on?)` | `ESC {` | Upside-down printing |
| `font('a'\|'b'\|'c')` | `ESC M` | Character font |
| `align('left'\|'center'\|'right')` | `ESC a` | Justification |
| `size(w, h?)` | `GS !` | Character magnification (1–8×) |
| `lineSpacing(dots?)` | `ESC 3` / `ESC 2` | Line spacing |
| `qrcode(data, opts?)` | `GS ( k` | QR code |
| `barcode(data, type, opts?)` | `GS k` | Barcode |
| `image(src, opts?)` | `GS v 0` | Raster image |
| `cut(type?, feed?)` | `GS V` | Full / partial cut |
| `cashDrawer(pin?, on?, off?)` | `ESC p` | Drawer kick-out pulse |
| `init()` | `ESC @` | Initialize printer |
| `custom(bytes)` / `raw(bytes)` | — | Raw bytes |
| `build()` | — | Get the result as `Uint8Array` |
| `clear()` | — | Discard accumulated commands |

## Browser usage

`build()` returns a plain `Uint8Array`, so sending it from a browser is just a matter of picking a transport:

```ts
// Web Bluetooth
await characteristic.writeValueWithoutResponse(data);

// WebUSB
await device.transferOut(endpointNumber, data);
```

There is nothing to polyfill — the encoder is pure JavaScript and ships its own conversion tables.

## Development

```sh
npm install
npm test                 # vitest
npm run typecheck        # tsc --noEmit
npm run build            # tsup → dist/ (ESM + CJS + d.ts)
npm run generate:tables  # regenerate src/tables/ from iconv-lite (devDependency)
```

## Contributing

Issues and pull requests are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Trademarks

QR Code is a registered trademark of DENSO WAVE INCORPORATED in Japan and other countries. EPSON and ESC/POS are registered trademarks of Seiko Epson Corporation. This project is not affiliated with or endorsed by these companies.

## License

[MIT](./LICENSE) © INIAD組み込み研究会 (INIAD Embedded)

The character-encoding tables in `src/tables/` are generated from mapping data in [iconv-lite](https://github.com/ashtuchkin/iconv-lite) (MIT License, Copyright (c) 2011 Alexander Shtuchkin).
