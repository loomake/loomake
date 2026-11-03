# Design

## Context

Opus設計ce45d508-aa08-4d34-b18a-3b0175275961を再利用する。対象はmain 0c5aaec2。コピーはこのworktreeの`.loomake/init-plan/reused-design-result.md`と`reused-design-manifest.json`、原結果と採用評価は旧init-67-359-design-20261103の`.loomake/`に保持する。既存initはquality/workflowを配らず、2行のqualityは読取最小として有効だが、対象がないのでci doneの合格にはならない。

## Goals / Non-Goals

**Goals:** #67/#359を1 changeにまとめ、本人回答A/Aをtraceへ記録する。配置と案内、空repoの配布物CLI試験を揃える。

**Non-Goals:** 4 reusableジョブの実装・公開refの作成、実workflow有効化、品質目標の推測、公開、既存設定や試験の緩和、新規則・工程。

## Decisions

- 既存REQ-020の差分確認・承諾/拒否・非TTY全中止・symlink保護を新配置にも適用する。公開APIとMINIMAL_QUALITY_YAML、既存commands/PM/gitignoreを保持する。
- qualityの案内は読取最小とdoneの対象・証拠を分ける。runtime/3や空対象/不足の非PASSを変えず、未同期REQ-310を重複MODIFIEDにしない。
- Q-I67359-01/02は2026-11-03の本会話で利用者がA/Aと直接回答した。目標未設定の雛形と設定案内、自動実行されない4ジョブ見本を対象にする。PQ-900を案件既定にせず、見本の配置と4ジョブの実稼働を区別する。
- REQ-396は`templates/quality.yaml`をinitFilesへ追加する。version/modelと空のobjectives/productを持つ雛形にし、案件の目標を自動採用しない。作成・上書きしたときだけ、テストランナー設定例の後に対象・証拠の設定案内を出す。同内容や上書き拒否時には出さない。
- REQ-397は`.github/loomake/workflow.example.yml`へ配置する。4つのusesは`loomake/loomake/.github/workflows/<job>.yml@v1`という呼出しの形を示す。v1を含む参照先・契約・固定refは未提供の見本と明記し、実行前に提供済み契約と固定refへ置き換えるよう案内する。`.github/workflows/`へ自動配置しない。
- REQ-398はquality-inputの不在案内だけを変更する。「最小の quality.yaml」の既存部分文字列、MINIMAL_QUALITY_YAML、runtime/3を保持する。読取りの最小と合格に必要な対象・証拠を分ける。REQ-310は別のactive changeが所有するため重複MODIFIEDにせずADDEDとする。

## 要件と試験の対応

| ID | 正の対照 | 負の対照・保持条件 |
|---|---|---|
| REQ-396 | CLI/APIで配置・一覧、schema/readQualityFileでloaded、tarballから空Gitへ導入 | 空対象は不足、同内容・TTY承諾/拒否・非TTY全中止、外部/不在リンク、案内は書込み時だけ |
| REQ-397 | 4ジョブのuses・未提供の明記・配置一覧、内部リンク | 実workflow非配置、同内容・TTY承諾/拒否・非TTY全中止、ファイルと祖先の外部/不在リンク |
| REQ-398 | ci doneの不在時nextに読取りの最小と対象・証拠、CLI/APIのruntime/3 | 2行と未知キーの読取互換、構文/型/版config/2、権限permission/3、spec-onlyとlocal doneの不在許容、ciの空対象・証拠不足は非PASS |

対応するテスト名に新IDを付け、既存保護も確かめる試験にはREQ-020/314等を併記する。元のassert・期限・skipと既存試験は保持する。導入文書はquality/workflowを置かないという旧説明を更新し、目標設定と見本の未稼働を説明する。

## Risks / Trade-offs

1 change・1実装PRを保ち、タスク2.1で雛形・見本・保護試験・配置文書、2.2で不在案内・分類回帰・案内文書、2.3で配布物の統合試験とchangesetを揃える。正式計画の増分も含むため、実装時にgit diffの変更行数を再計測する。300行目安を超えても条件や試験を削らず、必要なら内容不変の既存回帰を先行PRへ分ける。本人の1 change指定を保持する。

S2のarchive同梱には既存CIの修理が必要。過去headの合格・none偽装・一時移設で最終headを検証済みにしない。通常doneと最終CIを満たす手順が揃うまで未完とする。

CLIのdone不足を確かめる試験は、有効change・コマンド等を用意して空の品質対象だけを対照にする。「init直後は必ず不足/1」とは決めない。保持するIDはREQ-019/020/021/022/023/024/055/133/196/197/310/314/319で、元assert・期限・skipと読取互換を残す。
