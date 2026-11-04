# Tasks: fix-dependency-table-delimiters

## 1. 計画
- [x] 1.1 全6文書・採否・独立レビュー観点を固定し、strictとspec-onlyの実exit0を保存して小commitする。

## 2. 修理
- [x] 2.1 旧58例を一切変えずREQ-400の22例を追加し、旧sourceで受付/改行のassertion REDと拒否例成功を保存する。
- [ ] 2.2 区切り正規表現1行だけを修理し、追加22＋旧58の全80例GREENを実exit0で確認しkit patch changesetを付ける。
- [ ] 2.3 旧archive traceの8/9行の日付だけを11/3へ直し、7行目と全残余が不変と原回答本文へ照合する。

## Workflow follow-up
- 自身の差分仕様を同期してarchiveし、主仕様はWHEN2行だけ、旧archiveは日付2セルだけと照合する。日別worklogへ4項目を追記し、chsetを含む全予定変更をtracked commitして全量を数える。
- その後、標準 `pnpm -s verify --change fix-dependency-table-delimiters --done --scope local --json` を1回実行し、単一全normalgate実exit0・同時test reportを保存する。失敗なら停止し報告、追加retryは管理判断を待つ。tasksの完了印だけで成功を先取りしない。
- 起草者と別担当の自己レビュー、新規Opus独立レビュー重大0・軽微Issue追跡、必須CIと3OS、最終head照合を満たすまで完了・mergeとしない。計画だけのPRは作らず、C1b・親#285と後続未決は未完了とする。
