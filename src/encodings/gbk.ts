import type { EncodingDef } from '../encodings.js';
import table from '../tables/gbk.js';

/**
 * Simplified Chinese (GBK). Not registered by default to keep bundles
 * small — register it once at startup:
 *
 * ```ts
 * import { registerEncoding } from 'escpos-builder-ts';
 * import gbk from 'escpos-builder-ts/encodings/gbk';
 * registerEncoding(gbk);
 * ```
 */
const gbk: EncodingDef = {
  name: 'gbk',
  aliases: ['gb2312', 'chinese-simplified'],
  multibyte: true,
  table,
};

export default gbk;
