# Design

## Context

`--done --skip-commands` は、要件 500 件の性能の確認（REQ-050）と既存のテストで使っている。完了ゲートの合格は、AGENTS.md の完了の定義で `--skip-commands` を付けないコマンドに決まっている。

`ProcessLimitError` は `UsageError` を継承しており、CLI は `UsageError` を終了コード 2 にする。

## Goals / Non-Goals

省いたことを利用者と AI が必ず読めるようにする。`--done --skip-commands` を禁止はしない（性能の確認と既存のテストを保つ）。

run を始めたあとの失敗は、これまでどおり記録に残して終了コード 1 で止まる。git のリポジトリでない場合などの、run を始める前の git の失敗は REQ-137 のとおり終了コード 2 のまま残す。

## Decisions

- kit に `RuntimeFailure`（実行時の失敗）を足し、`ProcessLimitError` はこれを継承する。`UsageError` は継承しない
- CLI は `RuntimeFailure` を捕まえ、`loomake <コマンド>: <理由>` を標準エラーに出して終了コード 3 を返す。使い方は表示しない
- run は、始めたあとの `RuntimeFailure` も、これまでの `UsageError` と同じく記録に残して止まる
- 結果の項目は既存の `skip` の状態を使う。スキーマの形は変えない
- 候補は、編集距離が 2 以下で最も近い 1 つを示す
- 引数の解析は `node:util` の `parseArgs` を使わず、既存の解析に `=` の分割を足す。サブコマンドごとの日本語のエラーを保つため

- `external-process-budget` は bound-external-operations で足す capability なので、archive は bound-external-operations を先に行う。この change の MODIFIED は、その archive のあとでないと反映できない

## Risks / Trade-offs

終了コード 3 は新しい値なので、終了コード 2 を前提にした利用者のスクリプトは変わる。docs と CHANGELOG に書く。
