# Tasks: windows-owned-cleanup-phases

## 1. 仕様と記録

- [x] 1.1 採用設計、REQ-363の予約、Q-WRITER=C・Q-POOL・Q-SELFPID=Aと仮定をtraceへ記録し、REQ本文472 UTF-16文字・9 Scenario原文保持と出典を照合する。strictとspec-onlyが実exit 0であることを確認する。

## 2. 区間の記録

- [x] 2.1 T1〜T9のREQ-363回帰を先に追加し、helper不存在のmodule収集失敗だけにせず、既存PowerShell構造に対する意味あるREDを保存する。既存assert・期限・skipは変更しない。
- [x] 2.2 非同期fsの同時1要求、48行・8KiBとend予約、固定schema、解析と結果分類、保存の成功/失敗/捨てた行と完全性を実装し、新回帰をGREENにする。元13PS行・直後exit判定・2caseの既存行と3つめの呼出を保持し、挿入と省略引数だけであることを差分照合する。

## 3. 統合検証

- [ ] 3.1 docs/dev/ci.mdへ区間・原点・case-endの読み方と性能の未確定を記載し、文書リンク検査を通す。T1〜T9と全9 Scenarioの対応、既存原文と設定の保全、4項目worklogとL3計測表を準備する。
- [ ] 3.2 管理役と重い実行を調整してから、lint・typecheck・全件を通常verify --done --scope localの1回へ統合し、実exit 0と元レポートを確認する。dirty入力と最終headの対応を保存し、未実施の外部受入を区別して管理役へ渡す。

## Workflow follow-up

- main向けにloomake-change: windows-owned-cleanup-phases、loomake-tier: L3、ci:all-osでPRを作り、必須5チェック・3 OS CI・正常なci scope完了ゲート・独立Opusレビューと指摘対応を通常L3規則で満たす。push・PR・Opusは管理役が行う。
- 実Windowsの既存2caseのartifactでstdout/Flush・case-end・保存の遅れと欠測を観測し#275へ記録する。partialや終わりなしを成功とせず、元試験の失敗は失敗のまま残す。追加のPowerShell probeと52b再実行は行わない。
- 通常の受入後にarchiveする。診断追加やCI成功を根本原因の修理と報告しない。
