# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
