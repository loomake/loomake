# Proposal

## Why

W1-11の手動評価が未実装である。利用者決定Bと追加のA20手動受入、採用済みOpus設計に従い、C1で受け入れた静的観測を既存品質判定・追記専用の評価履歴へ接続する。

## What Changes

- `loomake trace eval`を追加し、既存の品質コマンドを一度実行して今回の出力だけを評価する。
- 製品品質と利用時品質を分け、測定していない値を未評価のまま保持する。
- requests・attempts・historyを追記専用のGit正本、quality-report.jsonを履歴末尾の索引として保存する。runIdとattemptの組だけを重複排除し、同コミットの別試行・翌期間と失敗試行を残す。
- 本C2aは単一実行者だけが要求を受け付け、取消・放棄・再評価待ち・回収不能を追跡する。競合時は未受付の3とし、他tokenを変えない。FIFOと待機票は通常後続C2bへ最終全文を移管する。
- 帳簿の厳密な許可リストと前後のHEAD・基準・出力検査で、評価した対象を変えない。共通CLI定義とリファレンスへevalだけを追加する。

## Capabilities

### New Capabilities

なし。quality-evaluationはC1（PR #440・#441）で主仕様へ入った。

### Modified Capabilities

- `quality-evaluation`: REQ-429・431〜434・437〜438・440〜442を追加し、手動eval・履歴・単一実行者の要求追跡を実装する。434・440・442は独立DoDを満たす中間本文である。
- `reference-docs`: REQ-323の全文を保持してevalの列挙と固有オプションなしを反映する。

## Impact

traceの評価・帳簿・要求状態、CLIの共通定義・信号処理・ルーティング・生成リファレンス、利用ガイドとchangeset。kitのC1 APIと既存四値判定を使い、既存12JSON Schema（8本と版付き4本）・品質設定・既存report・依存範囲と既存試験の期待値を保持する。

## Non-goals and transfer

C1 REQ-430は既存仕様で充足。REQ-439と434・440・442の最終全文・待機タスクはqueue-transfer.mdへ保持し、C2a受入・archive後の通常C2bで完成する。C3のstatusはc3-transfer.mdに原文と未実装タスクを残し、C2a・C2bの両方の受入・archive後に別changeとして進める。定期起動、Actions一覧照合、外部計測、利用者評価、工数自動推定、Issue/PR取得・投稿、履歴切り出しと長期保管を含めない。固定WBSは変更せず、C2だけで#70を閉じない。

## Prerequisite

通知APIのmain受入・同期archiveはQ70-21、分割と規模はQ70-22〜24a、実装順と完了条件はtasks.mdに記録する。
