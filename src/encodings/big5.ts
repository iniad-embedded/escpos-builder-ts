import type { EncodingDef } from '../encodings.js';
import table from '../tables/big5.js';

/**
 * Traditional Chinese (Big5). Not registered by default to keep bundles
 * small — register it once at startup:
 *
 * ```ts
 * import { registerEncoding } from 'escpos-builder-ts';
 * import big5 from 'escpos-builder-ts/encodings/big5';
 * registerEncoding(big5);
 * ```
 */
const big5: EncodingDef = {
  name: 'big5',
  aliases: ['chinese-traditional'],
  multibyte: true,
  table,
};

export default big5;
