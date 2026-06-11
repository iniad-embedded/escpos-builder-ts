# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-06-12

### Added

- Fluent `EscPosBuilder` producing ESC/POS byte streams (`build()` → `Uint8Array`)
- Text formatting: bold, underline, invert, upside-down, font, alignment, size, line spacing
- Multi-language text with automatic code page / Kanji mode switching:
  Japanese (CP932), Simplified Chinese (GB18030), Traditional Chinese (Big5),
  Korean (EUC-KR), and 20+ single-byte code pages
- QR codes via native `GS ( k` (model, module size, error correction)
- Barcodes via `GS k` function B (UPC-A/E, EAN-13/8, CODE39, ITF, CODABAR, CODE93, CODE128)
- Raster images via `GS v 0` with threshold and Floyd–Steinberg dithering
- Paper cut, cash drawer kick, printer initialization
- `.custom()` / `.raw()` escape hatch for vendor-specific commands
- ESM + CJS dual package with TypeScript declarations
