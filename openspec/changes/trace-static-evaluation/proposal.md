# Proposal

## Why

W1-11の手動評価が未実装である。利用者決定Bと追加のA20手動受入、採用済みOpus設計に従い、C1で受け入れた静的観測を既存品質判定・追記専用の評価履歴へ接続する。

## What Changes

- `loomake trace eval`を追加し、既存の品質コマンドを一度実行して今回の出力だけを評価する。
- 製品品質と利用時品質を分け、測定していない値を未評価のまま保持する。
- requests・attempts・historyを追記専用のGit正本、quality-report.jsonを履歴末尾の索引として保存する。runIdとattemptの組だけを重複排除し、同コミットの別試行・翌期間と失敗試行を残す。
- 手動要求をFIFOで待機させ、取消・放棄・再評価待ち・回収不能を追跡する。他tokenのロックを自動削除せず、自分の所有物だけを片付ける。
- 帳簿の厳密な許可リストと前後のHEAD・基準・出力検査で、評価した対象を変えない。共通CLI定義とリファレンスへevalだけを追加する。

## Capabilities

### New Capabilities

なし。quality-evaluationはC1（PR #440・#441）で主仕様へ入った。

### Modified Capabilities

- `quality-evaluation`: REQ-429・431〜434・437〜438・439〜442を追加し、手動evalと全要求追跡を実装する。
- `reference-docs`: REQ-323の全文を保持してevalの列挙と固有オプションなしを反映する。

## Impact

traceの評価・帳簿・要求状態、CLIの共通定義・信号処理・ルーティング・生成リファレンス、利用ガイドとchangeset。kitのC1 APIと既存四値判定を使い、公開8JSON・品質設定・既存report・依存範囲と既存試験の期待値を保持する。

## Non-goals and transfer

C1 REQ-430は既存仕様で充足。C3のstatusはc3-transfer.mdに原文と未実装タスクを残し、C2受入後に別changeとして進める。定期起動、Actions一覧照合、外部計測、利用者評価、工数自動推定、Issue/PR取得・投稿、履歴切り出しと長期保管を含めない。固定WBSは変更せず、C2だけで#70を閉じない。
