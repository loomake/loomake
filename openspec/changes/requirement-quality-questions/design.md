# Design

## Context

動機は proposal.md を参照。基準は main `7d7f69b5dfbd890798aa4589cf04ae64b63bc300`。既存 Skill の節 3/4/5 と trace の三表を使い、FR-02/03 を追加する。Opus 設計 `e8d1395f-995d-44a4-9170-61681bad0b20` と採否評価の補正を採る。

## Goals / Non-Goals

REQ-406/407 の七 Scenario を満たす。B1 の具体的 YAML 提案・既存の分割合意、B2 の合意した反映は後続とし、本 change は YAML を生成・編集しない。新たな承認手順、仮定承認、計測機構、architecture の訂正は加えない。

## Decisions

- 節番号を変えず、節 3 の小節に五項目と FR-03 を足し、節 5 で trace への記録を指示する。既存六分類の番号付き行を保つため、新しい分類は番号付きにしない。値は入力の出典、利用状況は実際の定義への参照を残し、不足を関連 Q にする。
- 両 trace 雛形の末尾に七列の「品質の定義」と出典・Q-ID の例を足す。既存の入力文書・台帳・確認事項・仮定の見出し、列、順序、例は保つ。parser や公開型に表を追加する案は採らず、既存の無視できる追加節として扱う。
- 判定基準を定義できない場合と観測が未実施の場合を分ける。旧六分類と「実装に影響するなら」を残す。品質の全未定を一律停止にする案は採らない。
- 既存 REQ-025〜033・055・059・136、REQ-034、品質 schema の UQ/PQ と linked_requirements、既存 evidence、parser/runtime/依存/設定と旧試験の assert は保持する。ISO2011 の init 雛形への回答を別案件のモデル選定へ流用せず、数値・モデル・語彙・出典を創作しない。

## Review and tests

独立レビューの観点を実装前に固定し、追加テスト名に要件 ID を入れる。REQ-406 の三 Scenario は `tests/kit-assets.test.ts` で五項目の全件確認・関連 Q・集約、雛形の列と例、`parseTrace` の errors=0 と旧三表の件数・列を確認する。REQ-407 の前三 Scenario は同ファイルで FR-03・観測待ちの区別・旧六分類・旧判断基準を確認し、既存 REQ-028 の試験も保持する。

REQ-407 の最後は `packages/kit/test/verify.test.ts` の既存 `traceMd`・`withProject`・`specOnly` を使う。新しい品質節と関連 REQ つき Q の未回答で exit 1 と Q-ID を確認し、同じ Q に回答・回答者・回答日を付けて exit 0 を確認する。旧期待値や test 設定は変えない。A-01 の静的検査、実 AI 生成、人による実案件確認を分け、静的成功を実生成成功とは報告しない。

## Risks / Trade-offs

[同じ Skill を変更する Issue 子との競合] → Issue 子は未受入である。実装前に `wbs66-issue-input-plan-20261103` の固定最終 head を確認し、ローカル依存として読み込み・取り込む。両 Skill の一致と Issue 子の旧指示を保持し、Issue 子の main 受入後に自身の差分と独立最終レビューを確定する。

[300 行の目安] → 下表は六 artifact の実数と、未編集の将来差分の行予算を分けて全量を加算する。意味のまとまった A を一つに保ち、実差分で明確に超えれば五項目の記録と FR-03 の境界で分ける。試験・仕様の削減や文章の圧縮で合わせない。

| 対象 | 加算・削除の行数 | 区分 |
|---|---:|---|
| 六 artifact | 157 | 作成済み実数 |
| main 仕様への同期 | 37 | delta の ADDED 見出しを除く実数 |
| 両 Skill | 20 | 追加予算 |
| 両 trace 雛形 | 14 | 追加予算 |
| root 構造・解析試験 | 35 | import と七 Scenario の構造・互換部分 |
| kit の仕様ゲート試験 | 22 | 未回答・回答済みの対比較 |
| 利用ガイド | 2 | 五項目と停止条件の案内 |
| JST 11/4 日誌・changeset | 12 | 判断・結果と kit patch |
| archive | 0 | 六 artifact の rename 検出時 |
| 合計 | 299 | 将来の実 diff で再確認 |

## Migration Plan

実装 PR 内で両 Skill と雛形を同期し、strict・spec-only・通常の local done を通す。主仕様への同期と archive、日誌は同じ作業 PR に含める。L3 の必須 CI・必要な三 OS・独立 Opus 最終レビュー重大 0 を確認し、軽微は Issue 化、merge 直前に head を照合する。Issue 子の受入が前提であり、plan-only PR は作らない。取り消す場合も旧契約と既存 YAML を保つ。
