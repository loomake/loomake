# Tasks

## 1. 五項目と FR-03

- [ ] 1.1 Issue 子の固定最終 head をローカル依存として確認・取り込み、両 Skill と trace 雛形に REQ-406/407 を追加する。七 Scenario の構造・解析試験と利用ガイドを同じコミット群に含め、旧六分類・旧三表・両 Skill の一致を既存試験と追加試験で確かめる。
- [ ] 1.2 `packages/kit/test/verify.test.ts` に品質節と関連 REQ つき blocking Q の対比較を追加し、未回答の exit 1・Q-ID と回答後の exit 0 を確認する。旧テスト・期待値・設定を保持する。

## 2. 統合確認

- [ ] 2.1 strict と spec-only を実行し、日誌に判断・結果を記録し、kit の patch changeset を追加する。全差分の行数を確認し、Issue 子受入後の自身の差分を固定する。
- [ ] 2.2 `pnpm -s verify --change requirement-quality-questions --done --scope local` を通す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装 PR で主仕様へ同期して archive する。旧仕様・Scenario・assert を保持し、必須 CI・必要な三 OS と独立最終レビュー重大 0 を確認する。軽微は Issue にし、merge 直前の head を照合する。
