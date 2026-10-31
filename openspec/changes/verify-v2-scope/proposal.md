# Proposal: verify-v2-scope

## Why

C-001（親change `verify-v2-c001`）を6つのPRに分けた4/6。2b-1/6で `runVerify` はscopeを受け取り、2.0.0を書き出すようになったが、CLIにはscopeを指定する手段がない。`verify --done` の既定はciなので、ローカルの完了（`--scope local`）をCLIから確かめられず、`trace record` も常にciで記録する。この子changeでCLIに `--scope local|ci` を足し、helpとCLIリファレンスをその定義に合わせる。出典は要件定義7.3、設計メモ（design-step8b、2章の4/6）、管理役の分割の決定（2026-10-31）。

## What Changes

- CLI：`verify` と `trace record` に `--scope local|ci` を足す（REQ-312・135・194・041）。受理値はlocalとciだけで、不正値と空値は使い方の誤り（終了コード2）。省くと `--done` はci、`--spec-only` とchangeなしはlocal。環境変数 `CI` では既定値を変えない。明示したscopeは指定どおりに扱う（changeなしのciも特別扱いしない）
- 共通定義 `args.ts` に受理値を置き、usage・help・リファレンスを同じ定義から出す。`docs/guide/3.reference/5.cli.md` を再生成し、生成器の `--check` を通す（REQ-323）
- 基準：`reference-cli-baseline.json` の旧46例は書き換えない。新しい契約で変わる出力は `reference-cli-baseline-changes.json` に具体差分として足す。差分を表せるよう、差分の記録に「stderrの何番目の出力か」と「旧文1行を新文の複数行に置き換える」書き方を足す（REQ-324）
- 試験：REQ-050の処理量（`--done --scope local --skip-commands`）を保持する

## Non-goals

- quality.yamlの判定への接続、ci.test_reportのadapter（5/6）
- 確認待ち・未承認仮定のdoneでの分類、NOT_APPLICABLE（3/6）
- AGENTS.mdのDoDの文言、雛形・READMEの更新（5b/6）
- `trace record` のscope以外の変更（REQ-066の確認は6/6）

## Capabilities

### Modified Capabilities

- `cli`（REQ-135・194・041）、`verify`（REQ-050・312）、`reference-docs`（REQ-323）

## Impact

既存試験の期待値は、helpとusageに `--scope` が増える箇所（基準の差分27例とcli.testのhelpの2件）だけを変える。基準の差分は利用者の個別承認の対象で、PR本文に一覧を載せる。archiveは6/6のあとに行う。
