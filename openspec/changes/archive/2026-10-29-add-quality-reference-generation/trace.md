# Trace: add-quality-reference-generation

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/wbs/baseline-v1.4.md W6-8、W6-6 | 固定v1.4、main 8426d8c | 2026-10-29確認 |
| Issue #104の作業・完了条件とdeliveryのquality先行範囲 | [Issue #104](https://github.com/loomake/loomake/issues/104) | 2026-10-29 |
| docs/requirements/loomake-v0.11.md 7.1 | v0.11.3、main 8426d8c | 2026-10-29確認 |
| openspec/specs/core-parsers/spec.md REQ-283〜287 | main 8426d8c | 2026-10-29確認 |
| packages/core/src/quality-schema.ts、json-schema.ts、schema/quality.schema.json、test/json-schema.test.ts | 現行の定義・生成・照合、main 8426d8c | 2026-10-29 |
| docs/guide/index.md、3.referenceの既存3ページ、tests/doc-links.test.ts | 現行の文書導線、main 8426d8c | 2026-10-29 |
| AGENTS.md、docs/adr/0005-keep-dev-mechanics-out-of-specs.md、docs/dev/ci.md | 製品内容と開発手順の境界 | 2026-10-29確認 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-320 | WBS W6-8・Issue104、現行qualityスキーマ、REQ-283〜287 | 機能 | quality.yaml全構造・NA分岐・既定値・制約をスキーマから生成し、未確定の意味を追加しない | 反映済 | specs/reference-docs/spec.md |
| REQ-321 | WBS W6-8・Issue104の再生成差分検出 | 品質 | 同じ入力から同じ内容を生成し、読み取り専用checkで一致/欠落/改変を検出してCIでずれを失敗にする | 反映済 | specs/reference-docs/spec.md |
| REQ-322 | WBS W6-6/8、Issue104のquality先行範囲、現行の文書導線・製品契約 | 移行 | 利用者が生成ページへ到達でき、既存文書と公開契約を保持しCLI/C-001を先取りしない | 反映済 | specs/reference-docs/spec.md |

REQ-305/306は既存集約、REQ-307は保持修正、REQ-308〜319はC-001用であり、本changeでは再使用しない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

quality先行範囲に未回答の製品仕様はない。metric/sourceの名前空間とC-001の未決契約は本範囲で採否を決めず、現行スキーマが持つ構造・注記だけを表示する。CLI生成は後続であり、このchangeだけではIssue #104をcloseしない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で埋めない。生成先のファイル名・安定した表示順・JSON Schemaからの描画・既存テスト経路での検査は、designに根拠を記した技術判断である。

## 依存と技術確認

| 対象 | 扱い・根拠 |
|---|---|
| #102 / W6-6 | 受入済み。guideの4章と既存リンク検査がある |
| #60 / W1-1 | 保持修正PR140はmain 8426d8cで受入済み。仕様反映・archiveはPR141のmain 684abf0への受入で完了し、Issueのcompletedを確認して実装依存を解消した。根拠は[Issue60](https://github.com/loomake/loomake/issues/60)と[PR141](https://github.com/loomake/loomake/pull/141) |
| 元スキーマ | 保存済み入力JSON Schemaにはproperties/items/record値/oneOf/required/default/制約があり、既存のZod生成一致試験を維持する |
| defaultの表現 | evidence親のdefault:{}と子の既定値を分け、解析後の補完結果は既存スキーマの最小入力で照合する |
| docs/dev例外 | 生成内容は利用者へ届くため本changeへ置く。開発者だけの実行手順・CIへの接続方法はdocs/devへ記す |
| C-001とCLI | C-001の型・判定・scope、CLI共通定義・生成は対象外。#139の質問へ回答したことにも扱わない |
| 検証の範囲 | 計画段階でstrictとspec-onlyを確認し、依存受入後に実装・ID付き試験へ進んだ。最終の全体done/必須CIは管理役の受入確認へ残し、4.1を未チェックで保持する |
