# effort-record

## Why

W1-9（Issue #68）の縮小後の範囲には、人の実作業時間を `trace record --effort` で追記する入口が必要である。現在の record は verify の証拠だけを保存するため、人の時間を記録するだけで品質検証を実行したことにしない入口を分ける。

出典は要件定義 v0.11.3 の FR-50・7.8、ADR 0006 の決定 B、Issue #68 の範囲決定コメント、Opus 設計と管理役の採用判断（trace.md）である。

## What Changes

- REQ-466 として、単位を明示した総計または区分別の時間、任意の判断要求・試行・費用・メモを、独立した Effort 1 の JSON へ追記する。
- 保存先を `.loomake/evidence/<change-id>/effort/` とし、既存の verify 証拠、release report、runner の再利用に混ぜない。
- active と archive 済みの change を受け付ける。未コミット拒否・上書きしない公開・オフライン動作を保つ。
- REQ-066・127・128 は全文と全 Scenario を保持し、`--effort` の場合に verify・検証文書の保存・検査前後の照合を行わない例外だけを追加する。
- core の導出型と遅延ロード、trace の同期 API、CLI のオプション表・help・生成リファレンスを追加する。既存の実行時依存と12本の公開 JSON Schema は変えない。
- 任意メモと入力由来の診断には #65 P1 の kit 共通置換を使い、置換後に構造とサイズを検査する。#65 P1 は未受入のため、この計画の製品実装は依存待ちとする。

## Capabilities

### New Capabilities

- `effort-record`: 人の時間と自己申告の付帯情報を、品質合格の証拠とは分けて追記する。

### Modified Capabilities

- `trace-record`: REQ-066・127・128 に `--effort` の適用除外を加える。

## Non-goals

この PR1 は記録の入口だけを扱う。手書き記録の読取（REQ-467）・9列の集計表（REQ-468）は PR2、#70 の品質状況レポートで回帰の疑いの直後へ載せる接続（REQ-469）は PR3 に残す。いずれも親 #68 の義務であり、この PR で親を閉じない。

C-001 の固定見積もり24〜58時間と change 欄「未作成」を書き換えない。実績を推測せず、C-002・C-003 の原本が見つかるまで親の実記録受入は保留する。欠測の placeholder を作って受入完了にしない。FR-49 の自動推定は承認済み決定 B に従って W7 の候補に残す。

M1/M2 の自動収集、M5 の取得範囲・単価出典・トークン内訳の自動補完、単独の効率表 CLI、#69 の未実装 schema、時刻や HEAD が異なる記録の直列化・exactly-once は追加しない。付帯の費用入力だけで M5 の全条件を満たしたと表示しない。

## Impact

対象は core の新しい effort の構造スキーマ・導出型・遅延 loader、trace の新しい effort モジュールと公開関数、CLI の args/main、生成リファレンス、追加試験と changeset である。既存の runRecord と runner の呼出、Evidence 1/2・Report 2、同期 API と JSON、既存試験・fixture・設定は保持する。
