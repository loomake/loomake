# Design

## Context

基準は main 7d7f69b5 から品質 A 04d07088 を明示的なローカル依存として取り込んだ head。Issue 子 821fc1f5 も含む。追加 Opus 設計 7ff1f5fc の X/Y と root の D1=A・D2=A・D3=present-quality-yaml-diff・D4=A を採る。旧 5d4a の「分割不可」の誤根拠は採らず、旧結果・留保・全七件 RED の ref は保つ。

## Goals / Non-Goals

X は同じ change-id の REQ-408 全五 Scenario と一般合意への接続を担う。Y の REQ-409 全二 Scenario は別 change へ移管し、B2 の REQ-410/411 全六 Scenario と 160c の計画は変えない。最終受入順は X→Y→B2 とし、許可済みのローカル先行は止めない。

## Decisions

- a470c39d の REQ-408 本文末尾と Scenario 1 の THEN に、作った案を既存の分割合意の中で確認する句だけを足す。Scenario 2〜5 は一字句保持する。ID・Scenario を振り直さず、出典有値・不足 Q・target・実定義参照・旧 evidence の義務を残す。
- 両 Skill の節 4 へ各十行の同じ小節、両 format の既存 proposal 節へ各二十一行の中立な例を追加する。X は具体差分・新規全文/model の明示・CI 証拠不足告知を先取りせず、Y が同じ小節内へ見出しなしで段落を加える余地を残す。
- 旧 a470/d649 は変更せず、A の上で自身の五試験だけを構成する。root の REQ-408 三件と kit 二件の全文を保持し、root 最初の it の既存 assert 後へ一般合意の expect 一行だけを追加する。旧 REQ-409 二件は Y へ移管し、試験削除コミットで分割しない。
- d649 の日誌七行は A の同日 prefix 後にそのまま保持し、X の結果は末尾へ追加する。旧記録の削除・書換えを行わず、計画だけの段階では日誌や製品ファイルを変更しない。

## Review and tests

独立レビューの観点は REQ-408 全五 Scenario と旧契約の保持で実装前に固定する。静的三件は値・Q・一般合意、target と旧 evidence、context の実定義参照を確認する。kit 二件は同じ例の loaded・関連 REQ・全必須 target と、観測零件で対象あり・PASS なしを確認する。旧 assert・期待値・skip・期限は変えない。

## Risks / Trade-offs

Issue 子と A は未 main。実装前に固定親 head を確認し、同じ Skill の旧指示・旧三表・六分類と REQ-025〜033・055・059・136 を保持する。runtime・公開 API・parser/schema・依存・設定は変えず、数値・品質モデル・語彙・出典を創作しない。静的検査・実 AI 生成・人の実案件確認を区別する。

| 対象 | 加算・削除の行数 | 区分 |
|---|---:|---|
| 六 artifact | 140 | 作成済み実数 |
| 主仕様同期 | 25 | delta から ADDED 見出しを除いた実数 |
| 両 Skill | 20 | 追加設計の実文案 |
| 両 format | 42 | 追加設計の実文案 |
| root 試験 | 15 | a470 の三件全文＋一般合意 assert 一行 |
| kit 試験 | 39 | a470 の二件全文・imports を保持 |
| guide | 1–2 | 案と一般合意の案内予算 |
| 日誌・changeset | 19 | d649 七行＋X の記録七行＋kit patch 五行 |
| archive | 0 | 内容不変の R100 rename 時 |
| 合計 | 301–302 | 将来の実 diff で確認 |

## Migration Plan

strict・spec-only・五試験の同じ最終内容による RED/GREEN・通常 local done を確認する。同じ作業 PR で同期/archive、日誌、changeset を含める。約三百行は目安とし、旧記録・試験・仕様・文章の圧縮や人工分割はしない。自身の差分は固定ローカル親基準で確認し、先行子 main 受入後の最終差分再確定・非作者自己レビュー・独立最終レビュー重大ゼロ・軽微 Issue 化・必須 CI と kit 三 OS・merge 直前 head 照合は後続手順へ残す。
