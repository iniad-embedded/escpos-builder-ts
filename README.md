# escpos-builder-ts

[日本語版 README はこちら / Japanese README](./README.ja.md)

A fluent, dependency-light ESC/POS command builder for thermal receipt printers, written in TypeScript.

- **Fluent API** — chain text, formatting, QR codes, barcodes, images, and cuts
- **Multi-language** — Japanese (Shift_JIS/CP932), Simplified/Traditional Chinese, Korean, and 20+ single-byte code pages (Western/Central European, Cyrillic, Greek, Turkish, Hebrew, Arabic, Vietnamese, …) with automatic code page / Kanji mode switching
- **QR codes** — native `GS ( k` commands (model, module size, error correction)
- **Images** — RGBA (canvas `ImageData`) or grayscale input, threshold or Floyd–Steinberg dithering, `GS v 0` raster output
- **Barcodes** — UPC-A/E, EAN-13/8, CODE39, ITF, CODABAR, CODE93, CODE128
- **Vendor commands** — `.custom(bytes)` escape hatch for model-specific commands
- Fully typed, tested with Vitest, ESM + CJS dual package

## Installation

```sh
npm install escpos-builder-ts
```

Requires Node.js ≥ 18.

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

## Multi-language text

Pass an encoding at construction or switch mid-stream with `.encoding()`. Code page (`ESC t`) and Kanji mode (`FS &` / `FS .`) commands are inserted automatically and only when the encoding actually changes.

```ts
const data = new EscPosBuilder({ encoding: 'japanese' })
  .textLine('いらっしゃいませ')   // CP932 (Shift_JIS) in Kanji mode
  .encoding('cp437')
  .textLine('Thank you!')
  .encoding('gb18030')
  .textLine('谢谢')
  .build();
```

### Supported encodings

| Name | Language / region | Mechanism |
| --- | --- | --- |
| `cp932` (`shiftjis`, `japanese`) | Japanese | Kanji mode, Shift_JIS |
| `gb18030` (`gbk`) | Simplified Chinese | Kanji mode |
| `big5` | Traditional Chinese | Kanji mode |
| `euckr` (`cp949`, `korean`) | Korean | Kanji mode |
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

## Development

```sh
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # tsup → dist/ (ESM + CJS + d.ts)
```

## Contributing

Issues and pull requests are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © INIAD組み込み研究会 (INIAD Embedded)
