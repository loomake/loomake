# Trace: add-trace-record

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
REQ の採番は、mvp 要件定義書の REQ-001〜062 に続けて、trace 要件定義書の登場順に REQ-063 から振る（全 change で共通）。
Q・A の番号は trace 要件定義書の中で通し番号にする。TRC-xxx は要件書側の ID。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/trace-v0.1.md（trace 要件定義書） | v0.1 | 2026-10-23 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-063 | 要件定義書 v0.1 §2 表の 4 行目 | 範囲外 | テストの実行は範囲外（kit の verify が受け持つ） | 範囲外 | proposal.md Non-goals |
| REQ-066 | 要件定義書 v0.1 §3.1 TRC-REC-01 | 機能 | `loomake trace record --change <id>` で `verify --done` を実行し、結果をコミットの SHA・日時と合わせて `.loomake/evidence/<change-id>/` に保存すること | 反映済 | specs/trace-record/spec.md |
| REQ-067 | 要件定義書 v0.1 §3.1 TRC-REC-02 | 機能 | 作業ツリーに未コミットの変更があるときは記録せず、理由を表示すること | 反映済 | specs/trace-record/spec.md |
| REQ-068 | 要件定義書 v0.1 §3.1 TRC-REC-03 | 機能 | 記録した証拠のファイルを書き換えず、新しい記録を別のファイルとして足すこと | 反映済 | specs/trace-record/spec.md |
| REQ-069 | 要件定義書 v0.1 §3.1 TRC-REC-04 | 範囲外 | 記録ごとに中身のハッシュを保存し、あとから書き換えがないかを確かめられるようにすること（フェーズ：次） | 範囲外 | proposal.md Non-goals |
| REQ-083 | 要件定義書 v0.1 §4 TRC-N-01 | 非機能 | 実行時の依存を `@loomake/core` と `@loomake/kit` だけにすること | 確認待ち | Q-04 |
| REQ-084 | 要件定義書 v0.1 §4 TRC-N-02 | 非機能 | ネットワークに接続しなくても動くこと | 反映済 | specs/trace-record/spec.md |
| REQ-089 | 要件定義書 v0.1 §4 TRC-N-07 | 非機能 | Node.js 20.19 以上で動作すること | 反映済 | specs/trace-record/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-02 | REQ-066 | 証拠の記録をリポジトリにコミットしますか（要件書 TRC-Q-02）。いまの `.gitignore` は `.loomake/` を丸ごと除外しているので、コミットするなら `.loomake/evidence/` だけを除外から外す必要があります | コミットする / CI の成果物として保存する | コミットする。CI の成果物は保存期間が過ぎると消え、検収のあとでレポートを作り直せなくなる | yes | |
| Q-04 | REQ-083 | `loomake trace` を CLI 本体 `loomake` のサブコマンドにすると、CLI が `@loomake/trace` に依存します。いまの仕様（verify「実行時依存の範囲」）は、CLI の依存を core と kit だけに限っています。どうしますか | CLI の依存に `@loomake/trace` を足す（既存の仕様を変える） / trace を別のコマンド（`loomake-trace`）として配る / trace のコードを kit に入れる | CLI の依存に `@loomake/trace` を足す。architecture.md の「CLI は 1 つで、サブコマンドを束ねる」方針に合い、`@loomake/trace` の依存は TRC-N-01 のとおり core と kit だけにできる | yes | |
| Q-06 | REQ-066 | 旧 Traspec のリポジトリ（traspec）のコードを、どこまで引き継ぎますか（要件書 TRC-Q-04） | 取り込んで作り直す / 新しく書く | 新しく書く | no | 新しく書く。traspec は取り込まず、参考にとどめる（2026-10-22 決定。docs/architecture.md 4 章） |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない） -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-066 | verify が不合格でも、結果を証拠として記録する。終了コードは verify と同じにする（合格 0・不合格 1） | 要件書は「結果を保存する」とだけ書いており、合格したときに限っていない。不合格の記録も、検収の経過として残す価値がある | |
| A-02 | REQ-067 | 「未コミットの変更」には、git が追跡していない新しいファイルも含める。`.gitignore` で除外したファイルは含めない | 追跡していないファイルも、検査の結果を変えうる | |
| A-03 | REQ-068 | 記録のファイル名は `<UTC の日時（YYYYMMDDTHHMMSSZ）>-<SHA の先頭 12 文字>.json` にする。同じ名前のファイルがあれば、記録せずに終了コード 1 を返す | 名前の順が記録の順になり、既存のファイルを上書きしない | |
| A-04 | REQ-066 | 記録の JSON は、verify の `--json` の結果をそのまま `verify` に入れ、`sha`（コミットの SHA 全体）・`committedAt`（コミットの日時）・`recordedAt`（記録した日時）・`schemaVersion` を足した形にする | 要件書に記録の形の記載がない。report が読むので、版を付けて形を固定する | |
