/**
 * Encoding definitions.
 *
 * Single-byte encodings map to an ESC t code page number (Epson standard
 * assignments). Multi-byte CJK encodings are printed via Kanji mode (FS &)
 * and rely on the printer's configured multi-byte character set.
 */
export interface EncodingDef {
  /** iconv-lite encoding name used to encode JavaScript strings. */
  iconv: string;
  /** ESC t code page number (single-byte encodings only). */
  codepage?: number;
  /** True for multi-byte CJK encodings printed in Kanji mode. */
  multibyte?: boolean;
}

const defs = {
  // --- Single-byte code pages (ESC t n) ---
  cp437: { iconv: 'cp437', codepage: 0 }, // USA / Standard Europe
  cp850: { iconv: 'cp850', codepage: 2 }, // Multilingual (Western Europe)
  cp860: { iconv: 'cp860', codepage: 3 }, // Portuguese
  cp863: { iconv: 'cp863', codepage: 4 }, // Canadian French
  cp865: { iconv: 'cp865', codepage: 5 }, // Nordic
  cp1252: { iconv: 'cp1252', codepage: 16 }, // Windows Western Europe
  cp866: { iconv: 'cp866', codepage: 17 }, // Cyrillic #2
  cp852: { iconv: 'cp852', codepage: 18 }, // Latin 2 (Central Europe)
  cp858: { iconv: 'cp858', codepage: 19 }, // Western Europe + euro sign
  iso88592: { iconv: 'iso88592', codepage: 39 }, // ISO 8859-2 (Latin 2)
  iso885915: { iconv: 'iso885915', codepage: 40 }, // ISO 8859-15 (Latin 9)
  cp1250: { iconv: 'cp1250', codepage: 45 }, // Windows Central Europe
  cp1251: { iconv: 'cp1251', codepage: 46 }, // Windows Cyrillic
  cp1253: { iconv: 'cp1253', codepage: 47 }, // Windows Greek
  cp1254: { iconv: 'cp1254', codepage: 48 }, // Windows Turkish
  cp1255: { iconv: 'cp1255', codepage: 49 }, // Windows Hebrew
  cp1256: { iconv: 'cp1256', codepage: 50 }, // Windows Arabic
  cp1257: { iconv: 'cp1257', codepage: 51 }, // Windows Baltic
  cp1258: { iconv: 'cp1258', codepage: 52 }, // Windows Vietnamese

  // --- Multi-byte CJK encodings (FS & Kanji mode) ---
  cp932: { iconv: 'cp932', multibyte: true }, // Japanese (Shift_JIS)
  gb18030: { iconv: 'gb18030', multibyte: true }, // Simplified Chinese
  big5: { iconv: 'big5', multibyte: true }, // Traditional Chinese
  euckr: { iconv: 'euckr', multibyte: true }, // Korean
} satisfies Record<string, EncodingDef>;

/** Friendly aliases resolving to canonical encoding names. */
const aliases = {
  ascii: 'cp437',
  latin1: 'cp1252',
  shiftjis: 'cp932',
  shift_jis: 'cp932',
  japanese: 'cp932',
  gbk: 'gb18030',
  'chinese-simplified': 'gb18030',
  'chinese-traditional': 'big5',
  cp949: 'euckr',
  korean: 'euckr',
} satisfies Record<string, keyof typeof defs>;

export type EncodingName = keyof typeof defs | keyof typeof aliases;

export function resolveEncoding(name: string): { name: keyof typeof defs; def: EncodingDef } {
  const canonical = (aliases as Record<string, string>)[name] ?? name;
  const def = (defs as Record<string, EncodingDef>)[canonical];
  if (!def) {
    throw new RangeError(`Unknown encoding: ${name}`);
  }
  return { name: canonical as keyof typeof defs, def };
}

export const ENCODINGS = defs;
