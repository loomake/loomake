# Scenario と試験の対応

既存26件とREQ-323の3件を保持し、各新Requirementに全体へ適用する共通契約を1件ずつ加えた。計33件。テスト名はすべて対応するREQ-IDを持つ。

| 要件 | Scenario（仕様順） | 試験群 |
|---|---|---|
| REQ-473 | 1. 公開契約の共通条件 | K |
| REQ-473 | 2. 証跡の追加だけの範囲 | K |
| REQ-473 | 3. コードや仕様の変更が混ざる | K |
| REQ-473 | 4. mainへの追従 | K |
| REQ-473 | 5. 証跡のパスに不正な形式がある | K |
| REQ-473 | 6. 読めない範囲 | K |
| REQ-473 | 7. 打ち消し合うコミットと置換参照 | K |
| REQ-473 | 8. 共有予算と厳密なdecode | K |
| REQ-474 | 1. 公開契約の共通条件 | T |
| REQ-474 | 2. 有効な証跡だけ | T |
| REQ-474 | 3. 要約を改変した | T |
| REQ-474 | 4. 信頼値がない、または同じrepoにある | T |
| REQ-474 | 5. 環境や基準が違う | T |
| REQ-474 | 6. 合格でない要約 | T |
| REQ-474 | 7. 差し戻しと再検証の理由が同時にある | T |
| REQ-474 | 8. 範囲のほかの証跡 | T |
| REQ-474 | 9. 要約がsourceに既にある | T |
| REQ-475 | 1. 公開契約の共通条件 | T |
| REQ-475 | 2. 再利用元と範囲を記録する | T |
| REQ-475 | 3. 既存の利用側への影響 | T |
| REQ-475 | 4. 記録を検証する | T |
| REQ-475 | 5. 同名と保存先の異常 | T |
| REQ-475 | 6. 秘密の形に当たる値を記録しない | T |
| REQ-475 | 7. 既知の欄の型の境界 | T |
| REQ-476 | 1. 公開契約の共通条件 | C |
| REQ-476 | 2. 混在のときは実際に再検証する | C |
| REQ-476 | 3. 判定中の変更 | C |
| REQ-476 | 4. JSONの出力 | C |
| REQ-476 | 5. 使い方の誤り | C |
| REQ-476 | 6. help | C |
| REQ-323 | 1. コマンドと操作の列挙 | R |
| REQ-323 | 2. 必須条件と省略時の振る舞い | R |
| REQ-323 | 3. 共通操作と境界 | R |

- REQ-473: `packages/kit/test/evidence-range.test.ts`。証跡の追加だけ／コードや仕様／mainへの追従／証跡の変更／読めない範囲／打ち消し合う／共有予算／型の不正／メタデータ。
- REQ-474: `packages/trace/test/evidence-reuse.test.ts`。有効な証跡だけ／要約の1文字／信頼値がない／環境や基準／合格でない／マージが同時／範囲のほか／sourceに既に。
- REQ-475: `packages/trace/test/evidence-reuse.test.ts、reuse-record.test.ts`。有効な証跡だけ／reportとrunner／範囲のほか／同名／秘密の形／全既知欄／runIdとrunAttempt。
- REQ-476: `packages/cli/test/trace-reuse-cli.test.ts、packages/trace/test/evidence-reuse.test.ts`。CLIの有効／混在／非0／JSONの4つ／判定中／使い方／help／再検証の中止。
- REQ-323: `packages/cli/test/reference-definition.test.ts`。既存REQ-323の生成・列挙・条件・共通操作試験を維持、reuseと解析順を追加。

共通契約は各要件の正常・拒否・境界試験群に分散して確認する。追加の配布試験は tests/package-artifacts.test.ts の [REQ-473][REQ-475][REQ-476] と、公開8型・2関数を含む tests/fixtures/public-api/consumer.ts.txt。実Git fixtureは runRecord(scope:ci) の実記録、repo外で凍結したanchor、実プロセスのカウンタを使う。
