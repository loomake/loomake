# Why

利用者の2026-10-30のdelivery指示1-1は、Node22.12以上という配布物の下限に合わないnode20の追加検査を削り、10秒を超えるcaseをVitestのslow projectへ分け、PRを軽くするよう求めている。現行monorepoにはNode20とPR時の全件実行を含む開発運用契約があるため、実装前に仕様との関係を整理する。

# What Changes

- `split-slow-ci-checks`を1 change・1 PRで進める。Node20ジョブ削除とslow分離を別PRの完成へ切り分けない。
- REQ-144はNode20追加検査だけを外し、3OS Node24とNode22.12.0の下限検査を保つ。
- ADR0005に従い、049/214の開発運用をdocs/dev/ci.mdへ移す。元の全文・8 Scenario・Source・旧試験名を保存し、利用者のPR軽量化に対応した運用を同文書へ記録する。主仕様の反映はchange経由のsync/archiveで行う。
- 最新headの3OS各3sampleで最大10秒超のcaseをOS別にslowへ分ける。PRの全経路でslowを実行せず、main push・scheduleとローカルの全件実行を保つ。releaseの既存manual dispatch品質ゲートも全件を保つ。
- named slow projectとroot globalSetupの共有build/pack、実際の13条件を検査するREQ-161のfast試験、元全caseと診断profilerの保持を、採用済みの設計に沿って実装する。

# Non-goals

テストの弱化、skip、期待値・時間上下限・予算・coverage閾値の緩和、製品の完成範囲縮小は行わない。REQ-297は退役させず、元4caseと全assertを保つ。旧108keyや過去の3OS観測は最新headの性能合格には使わない。

この起案時点ではCI・Vitest・製品実装を変えない。未設計10file、新fastの実測、PR179の受入後統合、実build/cleanup/watch検証、rulesetの人の操作は未完了である。新REQの採番、C001/S1/E3の契約の先取り、REQ-273の履歴衝突の解決、releaseの実行は含めない。

# Impact

対象はmonorepoの差分仕様、docs/dev/ci.md、後続実装のci.yml・Vitest config/setup・分割対象のテストと対応するworkflow照合試験・profiler・測定経路である。REQ-161の選択条件に必要な開発用mutation runnerの変更も同じPRで扱う。具体範囲と残設計はdesign/tasksを正本とする。

配布第3枠として管理役が割り当てた専用treeを使い、C001/S1と品質E3の既存所有を保つ。ruleset変更はnode20 contextだけの具体案を用意し、管理役がIssue121で人に依頼する。補助は規則を変更しない。
