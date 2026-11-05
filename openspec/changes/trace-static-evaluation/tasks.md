# Tasks

## 1. 仕様と移管

- [x] 1.1 C1受入、C2の全要件・親の19回答/2仮定、C3原文移管と採用済み設計を整合する。
- [x] 1.2 通知APIのmain受入・同期archiveを確認してQ70-21へ記録し、Q70-22〜26、C2aの中間契約とqueue-transferを整合する。P1/P2の限界・原37Scenarioの所有表を保持し、B0全差分・strict・仕様ゲートの実結果を管理役へ渡す。

## 2. 判定と台帳

- [x] 2.1 評価結果型・構造検査・kit四値集約、foldRequests・一意性・失敗解消・UTC期間を実装し、REQ-431・432・433・440・441のID付き試験を通す。
- [x] 2.2 パスの種類・自tokenロック・追記rollback・索引復旧・C2a作業ツリー許可リストを実装し、REQ-432・433・434・442の途中失敗/既存bytes保持を試験する。B1の全差分投影を管理役へ報告する。

## 3. evalと単一実行者の要求

- [x] 3.1 runEvalを既存品質コマンドとC1へ接続し、REQ-429全6Scenarioを実collectorで試験する。P1通常失敗/bail/各wrapper0のfixture、実Vitest bail、未実測/不整合/timeout/中断/起動失敗/出力超過/通知欠落のreceipt:nullと履歴保持を確認する。
- [x] 3.2 単一実行者の受付・取消・放棄回収を実装し、REQ-434・440・441の未受付競合3、実行中cancelled/3、二重信号後の残存lockと手動削除後回収、history後停止の補完、同日2回/翌日1回、token喪失側書込禁止、失敗を含む単調attemptを試験する。FIFO/待機2件の全未完タスクはqueue-transferに保持する。

## 4. CLIと文書

- [ ] 4.1 evalと既存run信号処理を接続し、REQ-437・438・323のhelp/不明オプション/候補/旧report/生成一致を検証する。REQ-427の旧試験と既存期待を保持し、evalの追加分だけを反映する。
- [ ] 4.2 手動eval/保存復旧のガイド・changeset・PR記録を整え、lint/型/関連試験/既存12JSON Schemaと依存の保持を確認する。
- [ ] 4.3 管理役の全件枠で通常local完了ゲートを実行し、実exit0・JSON・全要件試験を確認する。失敗なら完了扱いにしない。 <!-- loomake:gate=done -->

## 受入後の作業

管理役が非起草Codex・独立Opus・最終headの必須5/通常3 OS/scope ci完了を確認する。main受入後に同期archiveし、通常C2bでqueue-transferの最終全文と全タスクを完成する。C3はC2a/C2b双方のarchive後に進め、A20と#70の全受入は未完として残す。
