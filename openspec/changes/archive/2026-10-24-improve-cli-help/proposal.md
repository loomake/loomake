# improve-cli-help

## Why
実装全体の評価（作業記録 2026-10-23 の 42 節）で、CLI の使い勝手に 3 つの穴が見つかった。サブコマンドの `--help` は使い方の 1 行だけで、オプションの説明がない。`--change=<id>` の形は「知らないオプション」になる。知らないコマンドを指定しても、何が悪いかを言わない。

## What Changes
- サブコマンドの `--help` に、使い方の行・説明・各オプションの説明を載せる。`trace record --help` と `trace report --help` は、それぞれの使い方を出す（REQ-135）
- 値を取るオプション（`--change`・`--engine`・`--format`）は、`--change=<id>` の形でも受け付ける（REQ-041）
- 知らないコマンドを指定したら、そのコマンドの名前を挙げて知らないと表示し、終了コード 2 を返す（REQ-041）

## Non-goals
- 「change が無い」ときの終了コードを、コマンドのあいだでそろえること（verify は検査の不合格の 1、trace と run は使い方の誤りの 2）。verify の終了コードを変えると、利用者の CI の書き方に影響する
- 英語のヘルプ

## Impact
- 影響する capability：cli（Requirement の変更と追加）
- 影響するコード：`packages/cli/src/main.ts`
