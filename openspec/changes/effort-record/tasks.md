# Tasks: effort-record

## 1. 前提

- [ ] 1.1 #65 P1の共有maskValueがmainへ受入済みで公開APIが設計と一致する根拠をQ-19へ記録し、strictとspec-onlyがexit0になることを確認する。成功前は純関数を含め製品に着手しない（REQ-466）

## 2. coreの構造と公開型

- [ ] 2.1 Effort 1の構造スキーマ・導出型・定数・遅延loaderを追加し、排他形式・省略/0・不正値・静的zod非読込の追加試験とAPI説明で確かめる。既存12JSONの一致と依存不変も確認する（REQ-466）

## 3. traceの入力と記録

- [ ] 3.1 時間・区分・回数・費用・noteの同期パーサと検査を追加し、REQ-466の字句/数値境界・正確な分/cents変換・重複/混在/省略の追加試験で確かめ、受理文法の説明を添える（REQ-466）
- [ ] 3.2 runEffortRecord、共有置換後の検査、整形と原子的な保存を追加し、総計/区分・秘密形・raw診断非保持・サイズ・dirty・衝突・archive・保存失敗の追加試験で確かめる。既存runRecord/runnerと原記録が不変であることも確認する（REQ-466, REQ-066, REQ-127, REQ-128）

## 4. CLIと使い方

- [ ] 4.1 args/mainへeffortと付帯オプションを追加し、quality schemaより前の分岐、scope併用拒否、help、両構文、終了コードを追加試験で確かめる。CLIリファレンスを再生成し--checkと既存試験を無変更で通す（REQ-466）

## 5. 互換性と配布

- [ ] 5.1 effortサブディレクトリを既存証拠と混在させる追加試験で、release reportとrunnerの候補/出力が変わらないこと、旧Evidence1/2・Report2・全既存Scenario・同期APIと依存が不変なことを確認し、tdd.mdへ実際のRed/Greenを記録する（REQ-466, REQ-066, REQ-127, REQ-128）
- [ ] 5.2 core・trace・CLIの非破壊追加のpatch changesetと利用者向け説明を添え、tarballから新入口・help・既存公開元を追加試験で確かめる。原本欠測・親#68未完・PR2/3の残義務も文書に保持する（REQ-466）

## 6. ローカルの完了

- [ ] 6.1 全ScenarioとREQ試験対応、全実装タスクの完了を確認し、`pnpm -s verify --change effort-record --done --scope local` を通す（REQ-466, REQ-066, REQ-127, REQ-128） <!-- loomake:gate=done -->

注：現時点では全タスク未着手。ローカル完了は最終合格ではなく、CIのdone（scope ci）と必須5チェック、変更packageの3OS、Codexと独立Opusの通常L3レビューを別途満たす。

## Workflow follow-up

- main受入後に内容を照合して仕様同期/archiveを行う。
- PR2でREQ-467・468の手書き読取・9列集計、PR3でREQ-469の#70接続を通常L3として扱う。
- 親#68ではC-001の実績とC-002/C-003の手書き原本、実コマンドの観測、接続後の実出力を別に受け入れる。原本未取得をplaceholderで受入完了としない。
