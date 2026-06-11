import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'encodings/gbk': 'src/encodings/gbk.ts',
    'encodings/big5': 'src/encodings/big5.ts',
    'encodings/euckr': 'src/encodings/euckr.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  esbuildOptions(options) {
    // Keep the encoding tables as literal UTF-8 instead of \uXXXX escapes.
    options.charset = 'utf8';
  },
});
