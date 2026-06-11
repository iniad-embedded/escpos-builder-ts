import type { EncodingDef } from '../encodings.js';
import table from '../tables/euckr.js';

/**
 * Korean (EUC-KR). Not registered by default to keep bundles small —
 * register it once at startup:
 *
 * ```ts
 * import { registerEncoding } from 'escpos-builder-ts';
 * import euckr from 'escpos-builder-ts/encodings/euckr';
 * registerEncoding(euckr);
 * ```
 */
const euckr: EncodingDef = {
  name: 'euckr',
  aliases: ['cp949', 'korean'],
  multibyte: true,
  table,
};

export default euckr;
