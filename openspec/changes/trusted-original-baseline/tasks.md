# Tasks: trusted-original-baseline

## 1. 仕様と設計

- [x] 1.1 REQ-376/377の出典・境界・分割を記録し、短いOpus設計の採用、strict、通常spec-onlyの終了0、2要件の500 UTF-16字以内を確認する（REQ-376・377）

## 2. 部品と試験

- [x] 2.1 canonical・Git object読取り・差分/主仕様manifestの3部品と3試験を元S1版から移す。本文のblobとcallbackを保持し、追加376タグのID付き試験でGit安全性・JSON境界・fence/CRLF/EOF/変更種別を確認する（REQ-376）
- [x] 2.2 原文書・原契約・横断条件・初回候補の構造照合の6部品と3試験を移す。原47/158/46/16、原本不一致、所有/Scenario/補完/置換/openの負例、主体未検証と防御的結果を追加377タグの試験で確認する。補完参照の重複拒否漏れを最小修理し、T-Dと、置換レコード・Scenario/句の採否参照の新3回帰T-E/F/GのRED→GREENも確認する（REQ-377）

## 3. 統合確認

- [ ] 3.1 全2要件10 Scenarioと実試験の対応を記録し、元callback・保護期待値・設定の不変、通常の全体品質・型・lint・build・レイヤー検査を確認する。実PR差分が200KiB以内であることも確認する（REQ-376・377）
- [ ] 3.2 `pnpm -s verify --change trusted-original-baseline --done --scope local`の実終了0を確認する（REQ-376・377） <!-- loomake:gate=done -->

注：3.2はローカルの完了。最終の合格はCIの通常gateでscope ci・completed・errors空・PASS・要判断なし・終了0、必須5チェック、変更packageの3OS、独立レビューを確認する。この注記はチェックボックスにしない。

## Workflow follow-up

- 受入後に主仕様の同期とarchiveを行い、実差分の段階で必要な検査とレビューを通す。
- 後続の具体基準・採否・judge・受け渡し・controller・独立照合の子を順に受け入れる。S1本体の全受入・同期/archive・base-built liveのあとにS2へ進む。
