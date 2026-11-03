# Tasks

## 1. 反映結果の報告

- [x] 1.1 Apply の実装最終 head を local 親に固定し、元 checkpoint 13e9817e の REQ-411 root 二ケースを同じ describe へ全文移管する。追加報告の RED と旧報告互換の PASS を確認し、両 Skill Step 7 の各六行と guide を追加して二件 GREEN・Apply 四件と旧 assert 成功を確かめる。
- [x] 1.2 strict/spec-only・全量と固定親基準の自身の差分を確認する。親の日誌 prefix を保持して子の判断結果を四項目へ短く追記し、kit patch changeset を含める。format・kit 試験・元 B2 branch は変更しない。

## 2. 統合確認

- [ ] 2.1 `pnpm -s verify --change report-quality-yaml-application --done --scope local` を通常実行で通す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装 PR で主仕様同期/archive を行い、親 main 受入後に自身の最終差分を再確定する。非作者自己レビュー・独立最終レビュー重大ゼロ・軽微 Issue 化・必須 CI/kit 三 OS・merge 直前 head 照合を確認し、Apply→Report の最終受入順を守る。
