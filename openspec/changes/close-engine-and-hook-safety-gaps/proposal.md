# Proposal: close-engine-and-hook-safety-gaps

## Why

正常終了したエンジンの子が残って後からファイルを書き換えることと、フックのFIFOを読み込む検査が停止しないことを、Linuxの一時環境で再現した。変更検査とコミットの前にこの2つを防ぎ、リンク先のコードは保護範囲に含まれないことを利用者に明示する。

## What Changes

- POSIXではエンジンの通常終了時にも、同じプロセスグループに残る子を停止し、後処理を待ってから呼び出し元へ戻す。通常の終了コードと出力、既存の中断・時間切れ・出力上限の判定を保つ。
- フックのスナップショットは、FIFO・ソケット・デバイスなどの特殊ファイルを開く前に拒否し、対象と理由を日本語で示してコミット前に止める。
- 通常のフックと、リンク先をたどらずリンク文字列を比較するREQ-204の契約を保つ。リンク先のコードと、別のセッションへ離脱したプロセスは保護範囲に含まれないと文書に明記する。
- Windowsでは既存の明示停止時のtaskkillを保ち、通常終了後の子の停止を新しく保証しない。POSIXの試験をWindowsの成功根拠にしない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`: 通常終了したPOSIXエンジンの同じプロセスグループの後処理と、正常結果の保持。
- `run-guards`: フック内の特殊ファイルの拒否と、フックを保護する範囲の説明。

## Impact

`packages/runner/src/engine.ts`、`packages/runner/src/guards.ts`、関連するrunnerのテストと`docs/security.md`を変更する。公開API、設定キー、実行時依存は増やさない。修正のchangesetと、Node24・下限Node22.12の回帰結果を記録する。実Claude・GitHub接続、Windows・macOSの実行成功は今回のLinux試験から推定しない。
