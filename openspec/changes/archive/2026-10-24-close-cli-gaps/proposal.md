# CLI のゲートと案内の抜けを塞ぐ

## Why

2026-10-24 の品質評価で、次の抜けが見つかった。

- `verify --done --skip-commands` は品質コマンドを実行せず、前回のテストのレポートで合格する。表示にも JSON にも、コマンドを省いたことが出ない
- 外部操作の時間切れ・出力超過・中断が `UsageError` として扱われ、使い方の誤り（終了コード 2）と区別できない
- `loomake.config.json` の JSON が壊れていると、`loomake run` だけがスタックトレースを出して落ちる
- `--change=foo` の形を受け付けず、`verfy` のような打ち間違いに候補を出さない

## What Changes

- `--skip-commands` で品質コマンドを省いたときは、結果に `skip` の項目を必ず加え、表示の最後にも省いたことを書く
- 外部操作の時間切れ・出力超過・中断は、実行時の失敗として終了コード 3 を返す
- run も、壊れた `loomake.config.json` を日本語の設定エラー（終了コード 2）にする
- 値をとるオプションは `--name=value` の形も受け付ける
- 知らないサブコマンドとオプションには、近い候補を示す

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `verify`: 品質コマンドを省いたことの表示。
- `cli`: 実行時の失敗の終了コード、`--name=value` の形、打ち間違いの候補。
- `run`: 壊れた設定ファイルの扱い。
- `external-process-budget`: 制限による停止を、使い方の誤りではなく実行時の失敗として扱う（bound-external-operations の REQ-180・REQ-182 を変える）。

## Impact

kit の外部操作のエラーの型、verify の結果、CLI の引数の解析とテストを変える。実行時依存は増やさない。
