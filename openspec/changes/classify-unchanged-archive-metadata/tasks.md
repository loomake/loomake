# Tasks: classify-unchanged-archive-metadata

状態：Q1の具体案は2026-11-01に利用者が明示承認。承認記録と仕様ゲートを先に確認し、以下の順に実装する。main採用前は未適用。

## 1. 承認と仕様ゲート

- [x] 1.1 Q1 の具体案（quality の省略範囲、Q2〜Q5 の構成、未適用 AGENTS パッチ）への新しい承認を得て trace に出典・承認者・JST 日付を記録し、回答と全 artifact の一致を確認する。#260 の承認は使わない。
- [x] 1.2 `openspec validate classify-unchanged-archive-metadata --strict` と `pnpm -s verify --change classify-unchanged-archive-metadata --spec-only` を実行し、どちらも exit 0 と要判断なしを確認してから実装を始める。

## 2. 純粋な段階判定

- [x] 2.1 `tests/ci-tier.test.ts` に `[REQ-362][REQ-342]` の追加試験を作り、通常 id・日付付き id の正例が旧実装では L3 になる RED を記録する。別名・二重日付・不正日・不安全パス・R090・OID 不一致/不明・通常以外の両側モード・metadata 単独・A/M・任意 YAML・コード混在は既存の安全側の判定を維持することも確かめる。
- [x] 2.2 REQ-362 の候補集合と日付対応を `ci-tier.mjs` に実装し、2.1 の追加試験を GREEN にする。`0050-01-01-c1` と prefix 外の `2026-1-01-c1`、閏年・不正日も試験し、`isDocumentPath` と `classifyPath` の単独動作、既存 13 Scenario の試験の期待値が不変であることを確認する。

## 3. quality の呼び出し側

- [x] 3.1 `tests/ci-docs-only.test.ts` に `[REQ-362][REQ-270][REQ-281][REQ-282]` の偽 git と実 git の追加試験を作り、正常 R100 の docsOnly が false になる RED を記録する。OID の失敗・空・不正出力・不一致、mode 不正、名前衝突、ツリー読取失敗、main 以外の base、main push の負例を確認する。
- [ ] 3.2 merge-base と完全 OID の遅延照合を共有し、候補集合だけを文書外パスの事前拒否から除く。全パスの mode・名前・ツリー検査と既存呼出数の期待値を維持して 3.1 を GREEN にし、REQ-362 の限定条件と main 採用後の適用を `docs/dev/ci.md` に記載して文書リンク検査を通す。

## 4. gate と規則文書

- [ ] 4.1 `tests/ci-gate-process.test.ts` に `[REQ-362][REQ-342][REQ-343]` の実プロセス追加試験を作り、対象 change のない正常 archive で L1・lint/doc-links だけ・exit 0 となる期待の RED を記録する。別 change への移動は L3/失敗、存在しない明示 change と L3 none の拒否は保持する。
- [ ] 4.2 gate が同じ候補集合・OID 照合を段階判定と change 選択に使うよう実装し、4.1 と既存 gate 試験を GREEN にする。Q1 で承認された `proposed/AGENTS.md.patch` の最小追記だけを実体へ反映し、承認との差分がないことを確認する。

## 5. 通常 L3 の統合検証と受入

- [ ] 5.1 追加・既存回帰、lint・型検査・全件試験と `verify --done --scope local` を通し、REQ-362・342 に対応する試験、全タスクとゲート結果を照合する。既存試験の弱化・skip・期待値の緩和・設定緩和がない差分を確認する。
- [ ] 5.2 レビュー/CI用の全差分・要件対応・検証証跡と4項目worklogを揃え、未実施のCI・独立レビュー・main採用を区別して管理役へ引き継ぐ。

## Workflow follow-up

以下は必須の外部受入であり、ゲート前taskの完了へ代用しない。元5.2の条件を保持する：

- `ci:all-os` と必須 5 チェック、CI の完了ゲート、独立 Opus レビューと指摘対応を通常の L3 規則で完了し、証跡と 4 項目 worklog を揃える。人の規則承認とすべての受入条件を確認して main に採用する。

- main 採用後にこの change を正規の sync/archive 手順で反映し、主仕様 strict と原文保持を確認する。
- #238 の archive 案を採用後の main へ取り込み直し、REQ-359 の原文同期・元の6ファイル保存と移動・CI の L1 を確認する。採用前に本文強制や metadata 削除で迂回しない。
