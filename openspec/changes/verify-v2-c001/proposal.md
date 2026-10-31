# Proposal: verify-v2-c001

## Why

現行 verify は `ok/results` の 1.0.0 を返し、quality.yaml を判定へ接続していない。要件定義7.3と固定WBS 5章のC-001に従い、最小入力・限定した条件判定・実行エラーを区別する入口を、公開側と既存利用側を同じchangeで移行して準備する。

## What Changes

- **BREAKING** verify JSON を `schemaVersion: 2.0.0` の実行状態・scope・4値判定へ移す。aborted と終了コード0〜3を契約試験にし、旧1.0.0は履歴閲覧に限って残す。旧JSON Schemaの版付き追加公開はR-C001-09 Aの承認を反映した。
- quality.yaml `version: 2` を読み、対象外の理由・確認者、比較条件、証拠不足、集約を純関数で判定する。最小adapter/planの取得範囲とS1判定器はR-C001-03/04 Aの承認を反映し、未取得・未照合の証拠をPASSにしない。
- kit/CLI、ci-gate、runner、trace record/report、埋め込みJSON Schema、公開型・配布物・移行説明を一体で追従させる。
- quality.yamlの初期準備はci.test_reportの1必須項目を持つ初期内容と、切替当日の全open PRの再検証はR07 Aの承認を反映した。31副特性のinit生成全体（#66）は含めない。
- [明示回答](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693)に基づきR01/02/03/04/07/09/10はAと記録した。非互換範囲（R05）・ローカルDoD（R06）・警告/省略コマンドの分類（R08）は保留であり、製品実装を始めない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `core-parsers`: verify 2.0.0と履歴1.0.0、埋め込み証拠とレポートの版を区別する。
- `verify`: quality読取、scope、aborted、終了コードとJSON出力を定める。
- `verification-policy`: 限定した条件判定・集約と件数を定める。
- `trace-record`: v2結果を新しい証拠形式で記録する。
- `trace-report`: 新旧の閲覧を維持し、旧形式・localを最終合格に使わない。
- `run-decision-policy`: v2のdecision・実行状態・local完了を読んで停止と継続を決める。
- `monorepo`: ci-gateを同時追従させ、公開契約と移行を配布物で確認する。
- `external-process-budget`: 予算単独変更の版不変と、別途承認する形式移行を区別する。
- `reference-docs`: quality生成/check単独の不変範囲を明確にし、CLI共通定義と生成基準の移行を計画する。
- `verification-policy`（REQ-306）: summary・件数・verifyへの非接続を集約定義単独の範囲へ限定する。
- `run`（REQ-100）: 完了ゲートをverify --done --scope localと同じ検査へ追従する。
- `trace-agreement`: 未承認の案内と承認後の表示をv2用語へ追従する。
- `run-pr`: local完了と最終CI合格を区別してv2証拠とDraft PRを作る。
- `run`: v2/local証拠の同一状態での外部再試行と旧版非再利用を整合する。

## Impact

対象はcore・kit・trace・runner・CLIと `scripts/ci-gate.mjs`、関連fixture、配布smoke、互換性文書。verifyを埋め込むEvidenceは2へ上げ、旧Evidence 1の閲覧を保持する。Report 2とRunSummaryの外形は維持し、既存フィールドへ投影する。core・kit・trace・CLIの公開契約の破壊的変更にはminor、内部追従だけのrunnerにはpatchのchangesetを計画し、形式版とは分ける。

本PRは計画のみ。branch作成時の基準はmain `f397109`。その後、#60の未知キー保持修正（REQ-307）はPR #140と仕様反映・archiveのPR #141で受け入れられ、#60はclose済みで、最新にfetchしたmain `d5aa30d7a9326be44ea4eac5145b5fa95529efce`に含まれる。このmainを通常mergeで取り込み、PR #155でCLI/URL両changeの同期/archiveとREQ-322の短縮文面が受け入れられた正本へ基準を合わせた。実装を止めているのは保留のR-C001-05/06/08と仕様ゲートであり、#60を現在の未受入依存には数えない。既存REQ-305・307は意味を引き継いでMODIFIEDとし、REQ-306や使用済みIDを別の要件へ再割当しない。新しい要件IDは今回割り当てない。

## 部分承認と残るA案の具体化

[design-candidate-a.md](design-candidate-a.md)に、承認済み7件を保持し、残る3件もAの場合のsource/metric・検証計画・最小適格性・信頼する検証器の準備・正常自己ゲート・受入例を整理した。S1準備とprivate handoffを含むR-C001-04 Aは承認されたが、非互換範囲・DoD・警告分類の採否は残る。差分仕様には承認済みの反映と、保留項目に依存する候補を分けて記した。Bがあれば該当部分を再設計し、この全A案を無条件に実装しない。

## C-003との境界

C-001は最小quality入力、条件と集約、abortedと終了コード、`--done --json` の骨組みまで。C-001へ先行する最小実証跡の範囲はR-C001-03 Aを反映した。全providerの接続、完全なhost隔離、広いCI成果物取得・再利用連鎖、最小接続以外のpartial取得経路と全禁止フィールドの網羅試験はC-003へ残す。A案の最小接続に必要なproducer/version・実効手順・対象版/SHA/spec・環境・鮮度・信頼する基準との照合と実施確認はC-001に含める候補とし、C-003へ先送りしたまま正常PASSにしない。2.0.0の構造にはpartialも定義し、C-001の限定実装を契約全体の完了や証拠再利用の許可とは扱わない。#61・63・64全体をcloseしない。

## 3つのPRへの分割（2026-10-31）

C-001は3つのPRに分けて受け入れる。1本目は子change `verify-v2-shape` で、契約の形を追加だけで用意する。2本目は子change `verify-v2-wiring` で、書き出しと利用側を2.0.0へ切り替える。3本目はこの親で、正常PASSの受入と移行を行う。PRごとに `verify --done` を通すため、changeをPRごとに分けた。

Requirementは既存のIDのまま、重複させずに移す。新しいREQ-IDは作らない。REQ-183・274〜276・302〜310・313・314・316・322の17件は `verify-v2-shape` へ移した。REQ-274にあった書き出しの版を2.0.0にする文は、REQ-311へ移した。REQ-073は既存の試験の期待値を変えずには1本目で満たせないため、この親に残した。archiveは3本目のあとに、子change・親の順に行う。分け方の採否は`verify-v2-shape` のtraceの確認事項S8-01〜03に記録した。

2本目は、読む側の対応（`verify-v2-readers`）と書く側の切り替え（`verify-v2-wiring`）の2つのPRに分けた。PRの差分がOpusへの依頼の上限（200KiB）を超えたための管理役の決定（2026-10-31）である。`verify-v2-readers` へREQ-093・205を移した。REQ-093は承認済みR-C001-05 AのMODIFIEDとして子changeで確定した。

書く側はさらに3つに分けた（管理役の決定、2026-10-31）。全体は6本で、1/6 `verify-v2-shape`、2a/6 `verify-v2-readers`、2b-1/6 `verify-v2-wiring`（verifyの書き出しの切替。REQ-040・041・100・311・315）、2b-2/6 `verify-v2-evidence`（Evidenceの現行名の切替とreport。REQ-073・324）、2c/6 `verify-v2-strict`（旧形式の不合格。REQ-164・317・318）、4/6 `verify-v2-scope`（`--scope` のCLI。REQ-312・135・194・041・323・050）、6/6はこの親で受入を行う。

## 5bの移管

REQ-136のMODIFIEDと、親tasks5.1のDoD・配布文書・両雛形・kit-assets:251・REQ-136のScenario監査を子 `verify-v2-dod` へ移した。具体的な規則文と期待値の承認は未済で、子の提案patchは未適用である。親の元本文と残る受入は保持し、S1・親6/6までを完了扱いにしない。
