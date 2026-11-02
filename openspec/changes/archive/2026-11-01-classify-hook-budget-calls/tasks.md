# Tasks: classify-hook-budget-calls

計画文書を作成した段階では、以下の実装・追加試験・完了確認は未着手だった。現在の進捗は各チェック欄に記す。既存コードが先にあることや過去の61件成功を、これらの完了に代用しない。修理は仕様ゲートの成功と管理役の仕様確認のあとに始める。

## 1. 試験用観測の修理

- [x] 1.1 `packages/runner/test/process-diagnostics.test.ts` に `[REQ-350]` の新しいitで全6 Scenarioを追加する。自己変化getter・選択後のdata変更・先行qualityCommandのgetter・全trapのProxyは修理前のREDを記録し、診断envなし・固定plain・元throwも確認してから、A′とQ6(a)でobserverを直してGREENを確認する。既存の120〜161行相当のit・describe・期待値は保持する。
- [x] 1.2 `docs/dev/testing-across-os.md` に取得時点・mode/cwdと観測限界を反映し、REQ-350の試験と文書リンク検査が成功すること、元の引数・同期1回・返値/throw・診断envなしの保護が保たれることを確認する。

## 2. 分類と公開制限のID付き追加試験

- [x] 2.1 `tests/external-call-diagnostics.test.ts` の新しいdescribeへ `[REQ-351]` の全7 Scenarioを追加する。先行中断、補正窓の両端と1ms、窓内のnull/false/true、窓より前の3理由、mode不明、時計の欠損/逆転、gh-pr-createの別名をassertし、既存classifierの判定を保持して成功することを確認する。
- [x] 2.2 同じファイルと `tests/hook-budget-diagnostics-workflow.test.ts` に `[REQ-352]` の全6 Scenarioを追加する。旧rawのnull投影と位置別の分類、mode不正、版/型/未知キー拒否、秘密の除去、空でないexport先の拒否、固定4ファイル/7日/元1件選択/失敗保持を検査し、既存itとworkflowのassertを変更せず成功することを確認する。

## 3. 記録と保持の照合

- [x] 3.1 docsとworklogを修理後の事実へ更新し、none/正常done対象外という旧記録を履歴として保持したうえで現在の受入条件を明記する。基点・正式化前head・修理後headで元hook・workflow・設定・予算・旧it本文をバイト照合し、製品src・REQ-180/182/257の差分がないことを確認する。

## 4. 正常完了ゲート

- [x] 4.1 3要件すべての成功したID付き試験と全タスクの完了を照合し、`pnpm -s verify --change classify-hook-budget-calls --done --scope local` を省略指定なしで通す。exit0を確認してlocal完了として記録し、CIの最終合格と区別する。 <!-- loomake:gate=done -->

## Workflow follow-up

- PR #276の本文をこのchangeと通常L3へ合わせる。正常CI done（2.0.0/scope ci/completed/errors空/PASS/要判断なし/exit0）、必須5チェック、ci:all-osの3 OS、作者と設計担当とは別の独立Opus最終と計測表を揃えて受け入れる。統合先への段階受入例外は使わない。
- 同じheadの元hook診断を観測し、旧版や別headの標本と区別して記録する。単独成功をIssue #116の原因修理や完成とみなさない。
- 正常受入後にsync/archiveし、主仕様の3 Requirement・全19 Scenarioを確認してScenario監査の対応を登録する。Issue #116は原因解明/修理未達として開いたままにする。

受入後の注記：task2.1の「既存classifierの判定を保持」はA′のsnapshot修理段階を指す。受入前P2ではREQ-351の時計逆転Scenarioを満たすts<t1の独立判定だけを追加し、δ<−1と窓の前後1ms・旧試験を保持したうえで、task2.1・3.1・4.1を再開して通常local doneを通した。元のタスク本文と全6件の完了チェックは履歴として保持する。
