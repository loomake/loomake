# Trace: core-zod-verify-result

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #60](https://github.com/loomake/loomake/issues/60)「[W1-1] core：Zod スキーマと型」（作業・完了条件・完了条件に足りないもの） | - | 2026-10-28 |
| docs/wbs/baseline-v1.4.md の W1-1 の行と J01 | v1.4 | 2026-10-28 |
| docs/requirements/loomake-v0.11.md の NFR-01・NFR-02・7.3（互換性：未知のフィールドを通す） | v0.11.1 | 2026-10-28 |
| docs/architecture.md の 0.2・付録の「データ構造は Zod スキーマから型を導出する」（`tsc` と、JSON Schema の書き出しが CI で差分を出さないこと） | - | 2026-10-28 |
| docs/adr/0003-zod-as-core-runtime-dependency.md（`zod` を `dependencies` に足すのは W1-1） | - | 2026-10-28 |
| 依頼者の指示（作業中の担当とのチャット）：Issue #60 を実装する。1 つの PR に収まらなければ change を分け、最初の PR を出してから続ける | - | 2026-10-28 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-273 | Issue #60 の作業と完了条件、WBS の W1-1 | 機能 | 既存の手書きの型と JSON Schema（verify 結果）は、外部の形を変えずに Zod へ移す。スキーマから型を導出し、手書きの型の重複定義が残らない | 反映済 | specs/core-parsers/spec.md |
| REQ-274 | Issue #60 の作業、要件定義 7.3 の互換性 | 機能 | 未知のフィールドは受け付けて判定に使わず、証跡をそのまま読み書きする経路では保持する。Zod スキーマは未知のフィールドを通す設定で定義する | 反映済 | specs/core-parsers/spec.md |
| REQ-275 | Issue #60 の完了条件、アーキテクチャの付録、NFR-02 | 非機能 | 外部ツール向けに JSON Schema を書き出す。JSON Schema の書き出しが CI で差分を出さない | 反映済 | specs/core-parsers/spec.md |
| REQ-276 | Issue #60 の作業と「完了条件に足りないもの」 | 機能 | trace.md・spec・tasks に形式の版（`version`）を付け、Zod スキーマに移す | 範囲外 | 後続の change（Q-03） |
| REQ-277 | Issue #60 の作業と「完了条件に足りないもの」、要件定義 7.1 | 機能 | quality.yaml のスキーマ（`version`・`evidence:` の最小スキーマと既定値を含む） | 範囲外 | 後続の change |
| REQ-278 | Issue #60 の作業と「完了条件に足りないもの」 | 機能 | quality-report のスキーマと `version` | 範囲外 | 後続の change（Q-02） |
| REQ-279 | Issue #60 の作業（証拠・レポートを Zod へ移す） | 機能 | 証跡とレポートの版（packages/trace/src/schema.ts・report.ts）を Zod へ移す | 範囲外 | 後続の change |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-273〜REQ-279 | 要件 ID を REQ-273 から振った。main の最大は REQ-272 で、開いている PR はない。W1 のほかの作業を並行して進める change が同じ決め方をすると、番号が重なる。どう振り分けるか | A: 先にマージした方が番号を残し、あとの方が振り直す / B: 前もって番号を分ける | A。change gate-base-remote-ref の Q-01 と同じ扱いにする | no | | | |
| Q-02 | REQ-278 | quality-report JSON の項目は、要件定義（FR-25・FR-30・7.8）に内容の説明はあるが、フィールドの名前と形が決まっていない。スキーマをどう決めるか。この change の範囲外で、quality-report の change ではブロッキングにする | A: 7.8 の見出しと FR-25 から案を作り、人の承認を得てから実装する / B: `version` と最小の項目だけ定め、W2 の eval で足す | B。eval（W2）より前に項目を固めると、作り直しになりやすい | no | | | |
| Q-03 | REQ-276 | trace.md・spec・tasks は Markdown で、いまは版を書く場所がない。`version` をどこに持つか。この change の範囲外で、trace.md・spec・tasks の change ではブロッキングにする | A: 解析結果（Zod スキーマ）の版として core に定数で持ち、Markdown には書かない / B: trace.md などの冒頭のコメントに版を書き、解析で読む / C: OpenSpec の書式に合わせ、trace.md だけに版を書く | A。OpenSpec の書式（REQ-052・REQ-058）を変えずに済み、版の照合は解析結果で行える | no | | | |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-273、REQ-274 | 書き出した JSON Schema は、最上位と `results` の要素で `additionalProperties: false` をやめ、未知のフィールドを許す。`schemaVersion` は 1.0.0 のまま上げない | 要件定義 7.3 は、読み手が未知のフィールドを拒否しない契約とし、0.x の間はフィールドの追加で版を上げないとしている。いまの verify の出力は、変更の前後どちらのスキーマにも合う | | | |
| A-02 | REQ-275 | JSON Schema の書き出しの検査は、新しい CI の手順を足さず、core のテスト（CI の `pnpm test` で動く）で行う | テストは CI のすべての OS で動き、ビルドの前に差分を検出できる | | | |
