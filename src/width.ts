/**
 * Display-width calculation for receipt layout.
 *
 * On a fixed-pitch receipt printer, East Asian wide/fullwidth characters
 * (kanji, kana, hangul, fullwidth forms, ...) occupy 2 half-width cells and
 * everything else — including halfwidth katakana — occupies 1.
 *
 * Characters whose East Asian Width is "Ambiguous" (box drawing, ※, ①,
 * Greek/Cyrillic letters, ...) are full-width in CJK encodings such as
 * CP932 but half-width in Western code pages; pass `ambiguousAsWide` to
 * control this (the builder does so based on its current encoding).
 */

/** Pragmatic subset of East Asian Width "Ambiguous" ranges seen on receipts. */
function isAmbiguous(codePoint: number): boolean {
  return (
    codePoint === 0xa7 || // §
    codePoint === 0xa8 || // ¨
    codePoint === 0xb0 || // °
    codePoint === 0xb1 || // ±
    codePoint === 0xb4 || // ´
    codePoint === 0xb6 || // ¶
    codePoint === 0xd7 || // ×
    codePoint === 0xf7 || // ÷
    (codePoint >= 0x0391 && codePoint <= 0x03c9 && codePoint !== 0x03a2) || // Greek
    codePoint === 0x0401 ||
    (codePoint >= 0x0410 && codePoint <= 0x044f) || // Cyrillic
    codePoint === 0x0451 ||
    (codePoint >= 0x2010 && codePoint <= 0x203b) || // dashes, quotes, †‡※
    (codePoint >= 0x2460 && codePoint <= 0x24ff) || // enclosed alphanumerics ①②
    (codePoint >= 0x2500 && codePoint <= 0x26ff) // box drawing, blocks, shapes, ☆★
  );
}

/** Unicode East Asian Width Wide / Fullwidth ranges. */
function isWide(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f || // Hangul Jamo
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      // CJK Radicals Supplement .. Yi Radicals (excluding the half-fill space)
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xa960 && codePoint <= 0xa97f) || // Hangul Jamo Extended-A
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul Syllables
      (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK Compatibility Ideographs
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) || // Vertical Forms
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) || // CJK Compatibility Forms
      (codePoint >= 0xff00 && codePoint <= 0xff60) || // Fullwidth Forms
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) || // Fullwidth signs
      (codePoint >= 0x20000 && codePoint <= 0x3fffd)) // CJK Extension B+
  );
}

/** Display width of a single code point in half-width cells. */
export function charWidth(codePoint: number, ambiguousAsWide = false): 1 | 2 {
  if (isWide(codePoint)) return 2;
  if (ambiguousAsWide && isAmbiguous(codePoint)) return 2;
  return 1;
}

/** Display width of a string in half-width character cells. */
export function stringWidth(value: string, ambiguousAsWide = false): number {
  let width = 0;
  for (const char of value) {
    width += charWidth(char.codePointAt(0)!, ambiguousAsWide);
  }
  return width;
}
