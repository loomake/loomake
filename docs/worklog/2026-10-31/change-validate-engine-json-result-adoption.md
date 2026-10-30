# E3 の独立設計確認と実装引継ぎ

1. やったこと：validate-engine-json-result task1.3。head6c951b9の既存Opus A1/A2/A3/Bを照合し、管理役が採用した分類・AfterGuard・全OS長path試験・閉集合fixture・非永続化条件を計画へ記録した。8差分Requirement/41Scenarioは無変更。今回の重複起動417111fcは停止・未実施として保持した。PRは未作成。
2. verify：計画反映後のstrict/spec-onlyはexit0、全15検査。diffcheck成功。4計画文書をyomiyasuで点検し、契約用語と承認された変更は保持した。A3の未読資料を確認済みとは扱わない。
3. 残る事項：実CLI2版4件は保護前提が未確認のため未収集。採集・製品実装・done・CI・自動Codex・独立最終レビュー・親DoDは未完了。
4. 次：仕様ゲートを通した計画を固定し、task2.1の純粋分類から実装する。既存テスト・期待値・設定を保持し、採集待ちに依存しない製品D01〜D05を進める。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 未作成 | 未測定（既存4設計の再利用と管理採用） | 未実施 | 未実施 | 未実施 | 対象外（PR未作成） |

根拠：Issue121の予約コメント6524458298、design7章、trace E3-D01〜06、専用treeの `.loomake/e3-revised-design/existing-design-audit.json` と各Opus原本。全体の完了報告ではない。


## task2.1 の純粋分類

1. やったこと：元の標準出力をJSONで分類し、失敗の合図を型不正より先に判定する純粋関数と、分類・許可subtype・出力パスだけから理由を作る関数を追加した。新規37件を追加し、既存試験は変更していない。
2. verify：新規37件と既存45件の計82件、型確認が成功。対象lintの改行指摘1件を直して再確認する。task2.2のrun接続と全体doneはまだ実施していない。
3. 残る事項：task2.2以降、実CLI4件、CI・自動Codex・独立最終レビュー・親DoD。
4. 次：holdとAfterGuard、既存guardの表示・index解除をtask/repair両経路へ接続する。
