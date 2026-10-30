# split-slow-ci-checks 正式起案

1. tasks 1.1〜1.2としてREM049/214とMOD144を正式起案し、移管元全文・8Scenario・Source/旧試験名と管理役の回答を保存した。CI/テスト/設定/製品の実装は未着手。PRは未作成。
2. draftのstrict/spec-onlyはともにexit 0。最終headの再検証結果と対象headは専用treeの`.loomake/ci-formal-adoption/`へ保存する。
3. 未回答の確認事項と新しい仮定はない。未設計10file、PR179統合、実測と人のruleset操作は残task。release/localの全件検査は保持する。
4. 管理役へ正式起案を渡し、同じ1-1 PR内で残設計と実装へ進む。新Opus・push・PR・規則変更・releaseは実施していない。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 未作成 | 未測定（既存Opus成果の採用までの観測不足） | 未実施（今回は正式起案のみ） | 未実施 | 未実施 | 対象外（PR未作成） |

観測日：2026-10-31 JST。設計の根拠は62aba81dの実行情報とtraceの入力文書。各時間は欠測を0で埋めず、工程の重複を実工数へ加算しない。

## C2〜C5の先行準備

1. 管理役の指示に従い、tasks/design/traceの依存順を更新した。Node20削除・root準備・空のsplit足場・13条件の実試験を先行し、179統合/10file設計をcase分割と最終測定の前提として残した。
2. 更新後のstrict/spec-onlyを実行し、結果を`.loomake/ci-implementation/`へ保存する。
3. 新しい仮定や受入の削除はない。実装・測定のタスクは未完了である。
4. 仕様ゲート成功後に小さくcommitし、tasks 2.1から実装する。
