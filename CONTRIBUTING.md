# Contributing to escpos-builder-ts

Thank you for considering a contribution! / コントリビュートありがとうございます!

## Getting started

```sh
git clone git@github.com:iniad-embedded/escpos-builder-ts.git
cd escpos-builder-ts
npm install
npm test
```

## Development workflow

1. Fork the repository and create a branch from `main`.
2. Make your changes. Please:
   - keep the library dependency-light (currently only `iconv-lite`),
   - add or update tests in `test/` for any behavior change — tests assert exact byte sequences,
   - run `npm run typecheck && npm test` before pushing.
3. Open a pull request describing **what** changed and **why**. If the change affects emitted bytes, reference the relevant ESC/POS command (e.g. `GS ( k` function 167) and, ideally, the printer models you verified on.

## Reporting bugs

Please use the bug report issue template and include:

- the builder calls that produced the problem (a minimal snippet),
- the printer vendor/model,
- expected vs. actual output (a hex dump of `build()` helps a lot).

## Adding printer-specific features

Standard ESC/POS commands belong in `EscPosBuilder`. Vendor-specific commands should stay out of the core — document them in the README's vendor section or publish them as a subclass, as shown in the README.

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Be kind.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
