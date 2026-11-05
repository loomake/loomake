# Tasks

## 1. 計画

- [x] 1.1 REQ-455/456の出典・全Scenario・通知の例外と欠落の決定を整え、strictと仕様ゲートが実際に0になることを確認する（REQ-455・REQ-456）。

## 2. 通知API

- [x] 2.1 公開型・任意onCommandと二つの呼出経路を接続する。全終了種別・訪問timeout・skip/空/未訪問・change有無をREQ名付き試験で検証し、各通知が一度で追加実行がないことを確認する（REQ-455）。
- [x] 2.2 通知なしとの戻り値全体・JSON・終了コード・実行順と予算を比較する試験、callback例外の同一値伝播と後続未起動、通知変更の隔離試験を追加し、既存試験と合わせて成功させる。public-api fixtureに旧利用を残して新型を追加し、API説明とkit minor changesetを同時に追加して型検査を通す（REQ-456）。

## 3. 統合確認

- [ ] 3.1 全ScenarioとREQテストを照合し、lint・型検査と関連試験で回帰がなく、仕様ゲートも成功することを確認する（REQ-455・REQ-456）。
- [ ] 3.2 `pnpm -s verify --change expose-quality-command-outcomes --done --scope local` を通す（REQ-455・REQ-456）。 <!-- loomake:gate=done -->

最終の合格はPRのCIでscope ciの完了ゲートと必須5チェック、kitの3 OS試験、独立レビューの条件を満たしたときに判断する。ローカル成功だけで完了としない。

## Workflow follow-up

- main受入後に同期・archiveを行い、受入済み仕様を前提としてC2を再開する。
- C2親の全要件・全Scenario・FIFOと履歴・全要求追跡・C3移管を保持する。C2または#70を本changeだけで閉じない。
