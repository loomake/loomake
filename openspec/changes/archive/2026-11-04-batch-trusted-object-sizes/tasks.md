# Tasks

## 1. 計画

- [x] 1.1 採否・418一意性・全5Scenario・独立レビュー観点・同一PRの段取りを固定し、strict/spec-only終了0を保存する。

## 2. 同一PRの実装と回帰

- [x] 2.1 新規専用ファイルに現376のbaseline試験と共有fixture/spyを作り、既存sourceでPASSを記録する。別PR/main受入を依存にしない。
- [x] 2.2 baselineの期待を保持して418タグと全5Scenarioのbatch直接assertを追加し、source変更前の専用REDを保存する。既定16MiB等値/+1・fallback/停止を省かない。
- [x] 2.3 純粋判定・一括size・厳密応答検査・限定fallbackを実装し、新試験GREENと既存15試験・原文関連17例の無変更成功を確認する。

## 3. 受入

- [x] 3.1 同PRの主仕様同期/archive・kit patch changeset・日別worklogを含め全量を再計数し、ローカルlint・型・全試験とlocal doneの実終了0を確認する。

## Workflow follow-up

- 旧376/377と全5Scenarioを保持し、非起草自己レビュー・別Opus重大0/軽微追跡・必須5チェック・3OSを必須とする。archive後verifyとpush後の最終headを管理役が照合し、同じheadの受入条件を満たすまでマージしない。
