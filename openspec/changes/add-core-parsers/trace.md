# Trace: add-core-parsers

<!--
このファイルは scripts/verify.mjs が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
REQ の採番は要件定義書の登場順（全 change で共通）。F-xxx / N-xx は要件書側の ID。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/mvp-v0.1.md（Loomake MVP 要件定義書（core・kit）） | v0.1 | 2026-10-22 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-011 | 要件定義書 v0.1 §4 F-CORE-01 | 機能 | trace.md の「要件台帳」「確認事項」「仮定」の 3 つの表を読み、型付きのオブジェクトとして返すこと | 反映済 | specs/core-parsers/spec.md |
| REQ-012 | 要件定義書 v0.1 §4 F-CORE-02 | 機能 | 要件台帳の「状態」が 反映済・確認待ち・範囲外・既存仕様で充足 のいずれでもない行を、エラーとして報告すること | 反映済 | specs/core-parsers/spec.md |
| REQ-013 | 要件定義書 v0.1 §4 F-CORE-03 | 機能 | spec.md から、Requirement ごとに 操作（ADDED・MODIFIED・REMOVED・RENAMED）、名前、Source の要件 ID、Scenario 数を取り出すこと | 反映済 | specs/core-parsers/spec.md |
| REQ-014 | 要件定義書 v0.1 §4 F-CORE-04 | 機能 | tasks.md から、チェック済みと未チェックのタスクを取り出すこと | 反映済 | specs/core-parsers/spec.md |
| REQ-015 | 要件定義書 v0.1 §4 F-CORE-05 | 機能 | テストファイルから `[REQ-xxx]` 形式の要件 ID を取り出し、skip・todo 指定のテストは数えないこと | 反映済 | specs/core-parsers/spec.md |
| REQ-016 | 要件定義書 v0.1 §4 F-CORE-06 | 機能 | verify 結果の JSON スキーマを公開し、スキーマに `schemaVersion` を含めること | 反映済 | specs/core-parsers/spec.md |
| REQ-017 | 要件定義書 v0.1 §4 F-CORE-07 | 機能 | trace.md の空のテンプレートを生成する関数を提供すること | 反映済 | specs/core-parsers/spec.md |
| REQ-018 | 要件定義書 v0.1 §4 F-CORE-08 | 機能 | 解析エラーには、ファイル名と行番号を含めること | 反映済 | specs/core-parsers/spec.md |
| REQ-046 | 要件定義書 v0.1 §6 N-01 | 非機能 | `@loomake/core` は実行時の外部依存をゼロにすること | 反映済 | specs/core-parsers/spec.md |
| REQ-051 | 要件定義書 v0.1 §6 N-06 | 非機能 | OpenSpec 1.14 以上の change 書式を読めること | 反映済 | specs/core-parsers/spec.md |
| REQ-052 | 要件定義書 v0.1 §6 N-07 | 非機能 | Loomake の追加書式（`Source:` 行・trace.md）が `openspec validate --strict` を通ること | 反映済 | specs/core-parsers/spec.md |
| REQ-053 | 要件定義書 v0.1 §6 N-08 | 非機能 | verify の JSON スキーマに破壊的変更を入れるときは、`schemaVersion` のメジャー番号を上げること | 反映済 | specs/core-parsers/spec.md |
| REQ-058 | 要件定義書 v0.1 §7 1 項目目 | 制約 | 仕様の書式は OpenSpec に従い、Loomake 独自の仕様書式は作らない | 反映済 | specs/core-parsers/spec.md |
| REQ-062 | 要件定義書 v0.1 §7 5 項目目 | 前提 | 既存の verify.mjs と req-to-openspec Skill の試作版を出発点とする | 既存仕様で充足 | 既存：scripts/verify.mjs（design.md 参照） |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-11 | REQ-015, REQ-038 | 要件とテストの対応を、どの方法で判定しますか。試作の verify.mjs はテストファイルを静的に読むため、テストランナーが実行しないファイル（vitest.config.ts の include の外など）のテストも数えます。条件つきの skip（`it.skipIf`）や、変数で組み立てたテスト名も、静的には正しく判定できません（docs/review.md「コードの再レビュー」）。add-verify-cli の Q-11 と同じ質問で、回答は同じものを使う | 静的に読む（テストファイルを解析する。走査対象と実行対象を合わせるのは利用者の設定に任せる）/ テストランナーの結果を読む（test コマンドの JSON レポートから、実行して成功したテストの名前にある要件 ID を取る。REQ-015 の「テストファイルから取り出す」を読み替えることになる） | テストランナーの結果を読む。実際に実行して成功したテストだけを数えるので、実行対象のずれ・条件つきの skip・名前の組み立てをまとめて扱える。代わりに、どのランナーの JSON 形式（Vitest・Jest など）に対応するかを決める必要がある | yes | |
| Q-12 | REQ-015 | Q-11 で「静的に読む」を選んだ場合、条件つきの skip（`it.skipIf(...)`・`it.runIf(...)`）と、名前を変数やテンプレート文字列で組み立てたテストを、要件のテストとして数えますか。どちらも A-01 の skip の判定に入っていません | 数えない（静的に確かめられないものは数えない）/ 数える | 数えない。完了ゲートが誤って合格するより、テストが無いと誤って判定されるほうが害が小さい。Q-11 で「テストランナーの結果を読む」を選んだ場合は不要 | yes | |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない） -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-015 | 要件 ID の形式は `REQ-` と 3 桁以上の数字とする。skip・todo の判定は `it/test/describe` の `.skip`・`.todo` と `xit/xtest/xdescribe` | 要件書は `[REQ-xxx]` としか書いていない。試作の verify.mjs と同じ | 承認（2026-10-22） |
| A-02 | REQ-016, REQ-053 | `schemaVersion` は `MAJOR.MINOR.PATCH` の文字列で、初版は `1.0.0` とする | 要件書は「メジャー番号を上げる」としか定めていない | 承認（2026-10-22） |
| A-03 | REQ-012 | 台帳の状態の検査はこの関数が返すエラーとして行い、不合格にするかどうかは呼び出し側（verify）が決める | core は判定を持たず契約だけを担うため | 承認（2026-10-22） |
| A-04 | REQ-017 | テンプレート生成関数の名前は `createTraceTemplate({ changeId })`、中身は kit の `templates/trace.md` と同じ見出し・列構成とする | 要件書に関数名の指定がない | 承認（2026-10-22） |
| A-05 | REQ-011, REQ-013, REQ-014, REQ-015 | core のパーサはファイルを読まず、ファイル名とテキストを受け取る純粋関数とする（design.md） | core は CLI を持たず実行時依存ゼロのため | 承認（2026-10-22） |
