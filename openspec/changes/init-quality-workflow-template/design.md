# Design

## Context

Opus設計ce45d508-aa08-4d34-b18a-3b0175275961を受領した。対象はmain 0c5aaec2。原結果と評価はこのworktreeの`.loomake/init-67-359-design/`と`.loomake/claude/`に保持する。既存initはquality/workflowを配らず、2行のqualityは読取最小として有効だが、対象がないのでdoneの合格にはならない。

## Goals / Non-Goals

**Goals:** #67/#359を1 changeにまとめ、本人回答A/Aをtraceへ記録する。配置と案内、空repoの配布物CLI試験を揃える。

**Non-Goals:** 4 reusableジョブの実装・公開refの作成、実workflow有効化、品質目標の推測、公開、既存設定や試験の緩和、新規則・工程。正式specと新REQは未確定。

## Decisions

- 既存REQ-020の差分確認・承諾/拒否・非TTY全中止・symlink保護を新配置にも適用する。公開APIとMINIMAL_QUALITY_YAML、既存commands/PM/gitignoreを保持する。
- qualityの案内は読取最小とdoneの対象・証拠を分ける。runtime/3や空対象/不足の非PASSを変えず、未同期REQ-310を重複MODIFIEDにしない。
- Q-I67359-01/02は2026-11-03の本会話で利用者がA/Aと直接回答した。目標未設定の雛形と設定案内、自動実行されない4ジョブ見本を対象にする。PQ-900を案件既定にせず、見本の配置と4ジョブの実稼働を区別する。
- 本人回答後も、管理役がinit/verifyのADDED要件3件を採番し、全保持ID・正負試験を固定して仕様ゲートを通す。現在の文書だけでは実装を始めない。

## Risks / Trade-offs

全差分は選択により約260〜315行の見込み。300行を超えそうなら実装前に1 changeを保つタスク/PR配分を管理役へ示し、条件・試験を削らない。Opusの2 change案と行数だけの追加質問は採用しない。

S2のarchive同梱には既存CIの修理が必要。過去headの合格・none偽装・一時移設で最終headを検証済みにしない。通常doneと最終CIを満たす手順が揃うまで未完とする。

CLIのdone不足を確かめる試験は、有効change・コマンド等を用意して空の品質対象だけを対照にする。「init直後は必ず不足/1」とは決めない。保持するIDはREQ-019/020/021/022/023/024/055/133/196/197/310/314/319で、元assert・期限・skipと読取互換を残す。
