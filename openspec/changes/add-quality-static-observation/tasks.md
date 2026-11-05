# Tasks

## 1. 仕様

- [x] 1.1 REQ-430の出典と分割所有を記録し、strictと仕様ゲートを通す。

## 2. 実装

- [x] 2.1 既存の静的観測成果とnamed exportを移し、REQ-430の要件ID付き試験を通す。古い出力・実行ゼロ・件数未取得を測定値にしない。
- [x] 2.2 静的source/metricと呼出側の前提のガイド、changesetと作業記録を追加する。lint・typecheck・公開JSONと依存契約を確認する。

## 3. 確認

- [ ] 3.1 管理役の全件実行枠で通常 `pnpm -s verify --change add-quality-static-observation --done --scope local` を実行し、実終了コードとJSONを確認する。失敗なら未完へ戻す。 <!-- loomake:gate=done -->

最終受入は同じheadの通常CI完了ゲート・必須5チェック・kitの3OS・非起草Codex自己レビューと独立Opusで確認する。C2のevalと全要求追跡、C3のstatus、#70とW1の全受入は未完のまま残す。
