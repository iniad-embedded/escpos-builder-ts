# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-06-17

### Fixed

- Validate 1D barcode data against ESC/POS `GS k` requirements before emitting
  bytes, including digit-only/length constraints for UPC/EAN/ITF, allowed
  character sets for CODE39/CODABAR/CODE93, CODABAR start/stop characters, and
  CODE128 code set selectors.
- Escape literal `{` characters in CODE128 data when the builder automatically
  prefixes code set B (`{B`), preventing accidental control-sequence parsing by
  the printer.
- Fix the TypeScript typecheck by importing the `ImageSource` test helper type.

## [0.3.0] - 2026-06-17

### Fixed

- `.cut()` now emits `GS V 0` (full) or `GS V 1` (partial) when `feed` is 0
  (the default), cutting immediately without advancing the paper. Previously it
  emitted `GS V 65 0` / `GS V 66 0` (function B), which caused an unintended
  paper advance on many printers.

### Added

- `cropImage(source, top, height)` — returns a new `ImageSource` containing
  the rows from `top` through `top + height - 1`.
- `splitImage(source, ratio?)` — splits an `ImageSource` at `ratio` (default
  0.5), rounded to the nearest 8-pixel boundary. Returns `[top, bottom]`.
  Throws if the image is fewer than 16 rows tall.
- `EscPosBuilder.imageWithMidCut(source, options?)` — prints `source` spanning
  the cut position to fill the blank gap that thermal printers leave between
  the print head and the cutter on the next receipt. Accepts the same
  `ImageOptions` as `.image()` plus an optional `ratio` (default 0.5).
  Images shorter than 16 rows are printed whole followed by a cut.

## [0.2.0] - 2026-06-17

### Fixed

- cp932 (Shift-JIS) encoding now emits `FS C 1` before entering Kanji mode
  (`FS &`), preventing garbled output on printers that default to JIS when
  Kanji mode is activated without an explicit code-system selection.

### Added

- `EncodingDef.kanjiCode` — optional field for custom multi-byte encodings
  to specify a `FS C n` code-system selector emitted before `FS &`.

## [0.1.1] - 2026-06-13

Initial public release.

### Added

- Fluent `EscPosBuilder` producing ESC/POS byte streams (`build()` → `Uint8Array`)
- Text formatting: bold, underline, invert, upside-down, font, alignment, size, line spacing
- Multi-language text with automatic code page / Kanji mode switching and
  **zero runtime dependencies** (bundled, generated conversion tables — runs
  in browsers without Buffer or other Node polyfills):
  - Built in: Japanese (CP932/Shift_JIS) and 19 single-byte code pages
    (Western/Central European, Cyrillic, Greek, Turkish, Hebrew, Arabic,
    Baltic, Vietnamese, Nordic, ...)
  - Opt-in subpath modules to keep bundles small: Simplified Chinese (GBK),
    Traditional Chinese (Big5), Korean (EUC-KR)
  - `registerEncoding()` / `availableEncodings()` for custom code pages and encoders
- QR codes via native `GS ( k` (model, module size, error correction)
- Barcodes via `GS k` function B (UPC-A/E, EAN-13/8, CODE39, ITF, CODABAR, CODE93, CODE128)
- Raster images via `GS v 0` with threshold and Floyd–Steinberg dithering
- Receipt layout: `width` builder option plus `rule()`, `leftRight()`, and
  `table()` helpers with East Asian display-width measurement
  (`stringWidth()` / `charWidth()`, Ambiguous-as-wide in CJK encodings)
- Paper cut, cash drawer kick, printer initialization
- `.custom()` / `.raw()` escape hatch for vendor-specific commands
- ESM + CJS dual package with TypeScript declarations
