# escpos-builder-ts

[English README is here](./README.md)

> **開発途中** — このパッケージは現在開発中です。v1.0.0 までは予告なく API が変更される可能性があります。

サーマルレシートプリンター向けの ESC/POS コマンドを、メソッドチェーンで組み立てる TypeScript 製ライブラリです。

- **フルーエントAPI** — テキスト・書式・QRコード・バーコード・画像・カットをチェーンで記述
- **多言語対応** — 日本語(Shift_JIS/CP932)、簡体字・繁体字中国語、韓国語、および西欧・中欧・キリル・ギリシャ・トルコ・ヘブライ・アラビア・ベトナム語などの20以上のコードページ。コードページ切替・漢字モード切替コマンドは自動挿入
- **QRコード** — プリンターネイティブの `GS ( k` コマンド(モデル・サイズ・誤り訂正レベル指定可)
- **画像** — RGBA(canvas の `ImageData`)またはグレースケール入力、閾値 / Floyd–Steinberg ディザリング、`GS v 0` ラスター出力
- **バーコード** — UPC-A/E, EAN-13/8, CODE39, ITF, CODABAR, CODE93, CODE128
- **機種固有コマンド** — `.custom(bytes)` で任意のバイト列を挿入可能
- **ランタイム依存ゼロ** — 変換テーブル同梱の純TypeScript。Node.js・ブラウザ(Web Bluetooth / WebUSB / WebSerial)・Deno・Bunで動作
- 完全な型定義、Vitest によるテスト、ESM + CJS デュアルパッケージ

## インストール

```sh
npm install escpos-builder-ts
```

Node.js 18 以上およびモダンブラウザで動作します。Buffer等のNode polyfillは不要です。

## クイックスタート

```ts
import { EscPosBuilder } from 'escpos-builder-ts';

const data = new EscPosBuilder({ encoding: 'japanese' })
  .align('center')
  .size(2, 2)
  .textLine('領収書')
  .size(1, 1)
  .align('left')
  .textLine('りんご          ¥100')
  .textLine('バナナ          ¥50')
  .bold()
  .textLine('合計            ¥150')
  .bold(false)
  .align('center')
  .qrcode('https://example.com/receipt/123')
  .feed(3)
  .cut()
  .build(); // Uint8Array — USB / TCP 9100 / Bluetooth などでプリンターへ送信
```

このライブラリはバイト列の生成のみを行います。送信は任意の手段で行ってください。例(ネットワークプリンター):

```ts
import { createConnection } from 'node:net';

const socket = createConnection(9100, '192.168.1.50', () => {
  socket.end(data);
});
```

## 用紙幅とレシートレイアウト

用紙幅はプリンター本体の物理仕様で、ESC/POSに設定コマンドはありません。1行に入る半角文字数(203dpi・Font Aなら 80mm = `48`、58mm = `32`。正確な値は機種マニュアルの「印字桁数」を参照)をビルダーに渡し、レイアウトヘルパーを使ってください:

```ts
const b = new EscPosBuilder({ encoding: 'japanese', width: 32 }); // 58mm

b.rule()                       // --------------------------------
 .leftRight('りんご', '¥100')   // りんご                     ¥100
 .leftRight('バナナ', '¥50')
 .rule('=')
 .leftRight('合計', '¥150');
```

複数カラムの明細行には `table()` を使います(`width` を省略できるカラムは1つだけで、残り幅を吸収します。カラム幅を超えるセルは切り詰められます):

```ts
b.table(
  [{}, { width: 4, align: 'right' }, { width: 8, align: 'right' }],
  [
    ['りんご', '2', '¥200'],
    ['バナナ', '10', '¥500'],
  ],
);
```

`leftRight()`・`table()`・`rule()` は表示幅を正しく計算します: 全角(漢字・かな・ハングル等)は2桁、半角カナは1桁、East Asian Ambiguous文字(罫線 `━`・`※`・`①` など)はCJK系エンコーディングでは2桁・それ以外では1桁として扱います。幅計算関数は `stringWidth(value, ambiguousAsWide?)` としてエクスポートされています。

画像は `width` を印字可能ドット数以下(58mm = 384ドット、80mm = 512〜576ドット)にしてください。印字領域自体を狭めたい場合は、左マージン(`GS L`)・印字領域幅(`GS W`)コマンドを `.custom()` で送信できます。

## 多言語テキスト

コンストラクタでエンコーディングを指定するか、`.encoding()` で途中切替できます。コードページ(`ESC t`)・漢字モード(`FS &` / `FS .`)の切替コマンドは、実際にエンコーディングが変わったときだけ自動挿入されます。

```ts
import { EscPosBuilder, registerEncoding } from 'escpos-builder-ts';
import gbk from 'escpos-builder-ts/encodings/gbk';

registerEncoding(gbk); // 中国語・韓国語はバンドルサイズ配慮のためオプトイン

const data = new EscPosBuilder({ encoding: 'japanese' })
  .textLine('いらっしゃいませ')   // 漢字モード + CP932 (Shift_JIS)
  .encoding('cp437')
  .textLine('Thank you!')
  .encoding('gbk')
  .textLine('谢谢')
  .build();
```

### 対応エンコーディング

| 名前 | 言語・地域 | 方式 |
| --- | --- | --- |
| `cp932` (`shiftjis`, `japanese`) | 日本語 | 漢字モード, Shift_JIS |
| `gbk` (`gb2312`)² | 簡体字中国語 | 漢字モード |
| `big5`² | 繁体字中国語 | 漢字モード |
| `euckr` (`cp949`, `korean`)² | 韓国語 | 漢字モード |
| `cp437` (`ascii`) | 米国・標準欧州 | `ESC t 0` |
| `cp850`, `cp858`, `cp1252` (`latin1`), `iso885915` | 西欧 | `ESC t` |
| `cp852`, `cp1250`, `iso88592` | 中欧 | `ESC t` |
| `cp866`, `cp1251` | キリル文字 | `ESC t` |
| `cp1253` | ギリシャ語 | `ESC t` |
| `cp1254` | トルコ語 | `ESC t` |
| `cp1255` | ヘブライ語¹ | `ESC t` |
| `cp1256` | アラビア語¹ | `ESC t` |
| `cp1257` | バルト諸語 | `ESC t` |
| `cp1258` | ベトナム語 | `ESC t` |
| `cp860`, `cp863`, `cp865` | ポルトガル語・カナダフランス語・北欧 | `ESC t` |

¹ 右横書き(RTL)の整形は行いません。与えられた順序のまま印字されます。
² サブパスモジュールとして提供しています(ブラウザでのバンドルサイズ配慮のため)。`escpos-builder-ts/encodings/gbk`・`.../big5`・`.../euckr` をインポートし、起動時に一度 `registerEncoding()` に渡してください。日本語(`cp932`)と単バイトコードページはすべて本体組み込みです。独自のコードページやエンコーダーも `registerEncoding()` で登録できます。

> **注意** — 多バイト言語の印字には、対応する文字セットを搭載したプリンター(日本語なら日本語モデル)が必要です。コードページ番号は Epson 標準に従っています。他社プリンターで番号が異なる場合は、マニュアルを確認のうえ `.custom()` で `ESC t` を直接送信してください。

## QRコード

```ts
builder.qrcode('https://example.com', {
  model: 2,              // 1 | 2(デフォルト 2)
  size: 6,               // モジュールサイズ 1–16(デフォルト 6)
  errorCorrection: 'M',  // 'L' | 'M' | 'Q' | 'H'(デフォルト 'M')
  encoding: 'utf8',      // ペイロードのエンコーディング(デフォルト UTF-8)
});
```

## 画像

RGBA ピクセル(canvas の `ImageData` など)または 8bit グレースケールを受け取り、`GS v 0` で印字します。

```ts
// ブラウザ / node-canvas の場合:
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
builder.image(imageData, { dither: 'floyd-steinberg' });

// グレースケール(0 = 黒, 255 = 白)の場合:
builder.image({ data: grayPixels, width: 384, height: 200 }, { threshold: 128 });
```

Node.js で PNG/JPEG ファイルを印字する場合は、[`sharp`](https://github.com/lovell/sharp) や [`jimp`](https://github.com/jimp-dev/jimp) などでデコードして生ピクセルを渡してください。

## バーコード

```ts
builder.barcode('4901234567894', 'EAN13', {
  height: 80,           // ドット数 1–255
  width: 2,             // モジュール幅 2–6
  hriPosition: 'below', // 'none' | 'above' | 'below' | 'both'
  hriFont: 'a',
});
```

## 機種固有コマンド

標準 ESC/POS にない拡張コマンドは `.custom()`(エイリアス `.raw()`)でチェーンの任意の位置に挿入できます。

```ts
builder
  .textLine('こんにちは')
  .custom([0x1b, 0x70, 0x00, 0x19, 0xfa]) // 例: ドロワーキック
  .cut();
```

機種専用コマンドを再利用したい場合はビルダーを継承してください。

```ts
import { EscPosBuilder } from 'escpos-builder-ts';

class MyPrinterBuilder extends EscPosBuilder {
  buzzer(times = 1): this {
    return this.custom([0x1b, 0x42, times, 0x02]);
  }
}

new MyPrinterBuilder().textLine('お呼び出し').buzzer(3).cut().build();
```

## APIリファレンス

| メソッド | ESC/POS | 説明 |
| --- | --- | --- |
| `text(s)` / `textLine(s)` | — | テキスト印字(現在のエンコーディング) |
| `rule(char?)` | — | 行幅いっぱいの罫線 |
| `leftRight(left, right, pad?)` | — | 左寄せ+右寄せを1行に配置 |
| `table(columns, rows)` | — | カラムごとに幅・揃えを指定できる表組み |
| `encoding(name)` | `ESC t` / `FS &` | エンコーディング切替 |
| `newline(n?)` / `tab()` / `feed(n?)` | `LF` / `HT` / `ESC d` | 改行・タブ・紙送り |
| `bold(on?)` | `ESC E` | 太字 |
| `underline(mode?)` | `ESC -` | 下線(なし / 1ドット / 2ドット) |
| `invert(on?)` | `GS B` | 白黒反転 |
| `upsideDown(on?)` | `ESC {` | 180度回転 |
| `font('a'\|'b'\|'c')` | `ESC M` | フォント選択 |
| `align('left'\|'center'\|'right')` | `ESC a` | 行揃え |
| `size(w, h?)` | `GS !` | 文字サイズ(1–8倍) |
| `lineSpacing(dots?)` | `ESC 3` / `ESC 2` | 行間 |
| `qrcode(data, opts?)` | `GS ( k` | QRコード |
| `barcode(data, type, opts?)` | `GS k` | バーコード |
| `image(src, opts?)` | `GS v 0` | ラスター画像 |
| `cut(type?, feed?)` | `GS V` | フル / パーシャルカット |
| `cashDrawer(pin?, on?, off?)` | `ESC p` | キャッシュドロワー |
| `init()` | `ESC @` | プリンター初期化 |
| `custom(bytes)` / `raw(bytes)` | — | 生バイト列の挿入 |
| `build()` | — | `Uint8Array` として取得 |
| `clear()` | — | バッファ破棄 |

## ブラウザでの利用

`build()` は素の `Uint8Array` を返すので、ブラウザからは任意のトランスポートでそのまま送信できます:

```ts
// Web Bluetooth
await characteristic.writeValueWithoutResponse(data);

// WebUSB
await device.transferOut(endpointNumber, data);
```

エンコーダーは純JavaScriptで変換テーブルを同梱しているため、polyfillは一切不要です。

## 開発

```sh
npm install
npm test                 # vitest
npm run typecheck        # tsc --noEmit
npm run build            # tsup → dist/ (ESM + CJS + d.ts)
npm run generate:tables  # src/tables/ を iconv-lite (devDependency) から再生成
```

## コントリビュート

Issue・Pull Request を歓迎します。[CONTRIBUTING.md](./CONTRIBUTING.md) をご覧ください。

## 商標について

「QRコード」は株式会社デンソーウェーブの登録商標です。「EPSON」「ESC/POS」はセイコーエプソン株式会社の登録商標です。本プロジェクトはこれらの企業とは無関係であり、承認・提携関係はありません。

## ライセンス

[MIT](./LICENSE) © INIAD組み込み研究会 (INIAD Embedded)

`src/tables/` の文字コード変換テーブルは [iconv-lite](https://github.com/ashtuchkin/iconv-lite)(MITライセンス、Copyright (c) 2011 Alexander Shtuchkin)のマッピングデータから生成しています。
