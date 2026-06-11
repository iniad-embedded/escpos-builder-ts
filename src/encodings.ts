import cp932Table from './tables/cp932.js';
import { SBCS_TABLES } from './tables/sbcs.js';

/**
 * Encoding registry. Pure JavaScript — no Node.js or Buffer dependency.
 *
 * Single-byte encodings map to an ESC t code page number (Epson standard
 * assignments). Multi-byte CJK encodings are printed via Kanji mode (FS &)
 * and rely on the printer's configured multi-byte character set.
 *
 * Built in: all single-byte code pages and Japanese (cp932). Simplified /
 * Traditional Chinese and Korean ship as subpath modules to keep browser
 * bundles small — import and register them explicitly:
 *
 * ```ts
 * import { registerEncoding } from 'escpos-builder-ts';
 * import gbk from 'escpos-builder-ts/encodings/gbk';
 * registerEncoding(gbk);
 * ```
 */
export interface EncodingDef {
  name: string;
  aliases?: string[];
  /** ESC t code page number (single-byte encodings only). */
  codepage?: number;
  /** True for multi-byte CJK encodings printed in Kanji mode. */
  multibyte?: boolean;
  /**
   * Generated mapping table: for single-byte encodings, 128 chars for
   * bytes 0x80-0xFF; for multi-byte, a pair string of
   * [unicode char, code char] (code char = 1 byte or 2 big-endian bytes).
   */
  table?: string;
  /** Custom encoder; takes precedence over `table`. */
  encode?: (text: string) => Uint8Array;
}

export interface ResolvedEncoding {
  name: string;
  codepage?: number;
  multibyte: boolean;
  encode: (text: string) => Uint8Array;
}

type KnownEncoding =
  | 'cp437' | 'cp850' | 'cp852' | 'cp858' | 'cp860' | 'cp863' | 'cp865' | 'cp866'
  | 'cp1250' | 'cp1251' | 'cp1252' | 'cp1253' | 'cp1254' | 'cp1255' | 'cp1256'
  | 'cp1257' | 'cp1258' | 'iso88592' | 'iso885915'
  | 'ascii' | 'latin1'
  | 'cp932' | 'shiftjis' | 'shift_jis' | 'japanese'
  | 'gbk' | 'gb2312' | 'chinese-simplified'
  | 'big5' | 'chinese-traditional'
  | 'euckr' | 'cp949' | 'korean';

/** Built-in names get autocompletion; any registered name is accepted. */
export type EncodingName = KnownEncoding | (string & {});

const QUESTION_MARK = 0x3f;

function sbcsEncoder(table: string): (text: string) => Uint8Array {
  let reverse: Map<number, number> | null = null;
  return (text) => {
    if (!reverse) {
      reverse = new Map();
      for (let i = 0; i < 128; i++) {
        const cp = table.charCodeAt(i);
        if (cp !== 0xfffd) reverse.set(cp, 0x80 + i);
      }
    }
    const out = new Uint8Array(text.length);
    let n = 0;
    for (const char of text) {
      const cp = char.codePointAt(0)!;
      out[n++] = cp < 0x80 ? cp : (reverse.get(cp) ?? QUESTION_MARK);
    }
    return out.subarray(0, n);
  };
}

function mbcsEncoder(pairs: string): (text: string) => Uint8Array {
  let map: Map<number, number> | null = null;
  return (text) => {
    if (!map) {
      map = new Map();
      for (let i = 0; i < pairs.length; i += 2) {
        map.set(pairs.charCodeAt(i), pairs.charCodeAt(i + 1));
      }
    }
    const out: number[] = [];
    for (const char of text) {
      const cp = char.codePointAt(0)!;
      if (cp < 0x80) {
        out.push(cp);
        continue;
      }
      const code = cp <= 0xffff ? map.get(cp) : undefined;
      if (code === undefined) out.push(QUESTION_MARK);
      else if (code < 0x100) out.push(code);
      else out.push(code >> 8, code & 0xff);
    }
    return Uint8Array.from(out);
  };
}

const registry = new Map<string, ResolvedEncoding>();
const aliasMap = new Map<string, string>();

/** Register an encoding (built-in subpath module or your own definition). */
export function registerEncoding(def: EncodingDef): void {
  const encode =
    def.encode ??
    (def.table !== undefined
      ? def.multibyte
        ? mbcsEncoder(def.table)
        : sbcsEncoder(def.table)
      : undefined);
  if (!encode) {
    throw new TypeError(`Encoding ${def.name} needs a table or an encode function`);
  }
  if (!def.multibyte && def.codepage === undefined) {
    throw new TypeError(`Single-byte encoding ${def.name} needs an ESC t codepage number`);
  }
  registry.set(def.name, {
    name: def.name,
    codepage: def.codepage,
    multibyte: def.multibyte === true,
    encode,
  });
  for (const alias of def.aliases ?? []) {
    aliasMap.set(alias, def.name);
  }
}

export function resolveEncoding(name: string): ResolvedEncoding {
  const def = registry.get(aliasMap.get(name) ?? name);
  if (!def) {
    throw new RangeError(
      `Unknown encoding: ${name}. Register it first with registerEncoding().`,
    );
  }
  return def;
}

/** Names (without aliases) of all currently registered encodings. */
export function availableEncodings(): string[] {
  return [...registry.keys()];
}

// --- Built-in registrations ---

const SBCS_CODEPAGES: Record<string, { codepage: number; aliases?: string[] }> = {
  cp437: { codepage: 0, aliases: ['ascii'] }, // USA / Standard Europe
  cp850: { codepage: 2 }, // Multilingual (Western Europe)
  cp860: { codepage: 3 }, // Portuguese
  cp863: { codepage: 4 }, // Canadian French
  cp865: { codepage: 5 }, // Nordic
  cp1252: { codepage: 16, aliases: ['latin1'] }, // Windows Western Europe
  cp866: { codepage: 17 }, // Cyrillic #2
  cp852: { codepage: 18 }, // Latin 2 (Central Europe)
  cp858: { codepage: 19 }, // Western Europe + euro sign
  iso88592: { codepage: 39 }, // ISO 8859-2 (Latin 2)
  iso885915: { codepage: 40 }, // ISO 8859-15 (Latin 9)
  cp1250: { codepage: 45 }, // Windows Central Europe
  cp1251: { codepage: 46 }, // Windows Cyrillic
  cp1253: { codepage: 47 }, // Windows Greek
  cp1254: { codepage: 48 }, // Windows Turkish
  cp1255: { codepage: 49 }, // Windows Hebrew
  cp1256: { codepage: 50 }, // Windows Arabic
  cp1257: { codepage: 51 }, // Windows Baltic
  cp1258: { codepage: 52 }, // Windows Vietnamese
};

for (const [name, info] of Object.entries(SBCS_CODEPAGES)) {
  registerEncoding({ name, ...info, table: SBCS_TABLES[name] });
}

registerEncoding({
  name: 'cp932', // Japanese (Shift_JIS)
  aliases: ['shiftjis', 'shift_jis', 'japanese'],
  multibyte: true,
  table: cp932Table,
});
