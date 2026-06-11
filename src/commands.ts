/** Control bytes used by ESC/POS. */
export const NUL = 0x00;
export const HT = 0x09;
export const LF = 0x0a;
export const ESC = 0x1b;
export const FS = 0x1c;
export const GS = 0x1d;

/** ESC @ — initialize printer. */
export const INIT = [ESC, 0x40];
/** FS & — enter Kanji (multi-byte) character mode. */
export const KANJI_ON = [FS, 0x26];
/** FS . — cancel Kanji (multi-byte) character mode. */
export const KANJI_OFF = [FS, 0x2e];
