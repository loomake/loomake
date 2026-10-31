# Proposal

## Why

C001 の明示 scope へ移行した実装に対し、ローカルで通す完了ゲートを既定の ci と読める案内が残っている。親の承認済み R-C001-06 A に従い、ローカルの完了と最終 CI の合格を雛形と案内で区別する。

## What Changes

- 親 `verify-v2-c001` のタスク1.2の REQ-136 と、5.1の DoD・配布文書・両雛形・保護された期待値・REQ-136 の Scenario 監査を、この子へ移す。
- REQ-136 の元の Scenario と Source を保持し、local の印と最終 CI 注記の Scenario を加える。新しい要件 ID は作らない。
- 規則文と保護された期待値の具体案を `proposed/implementation.patch` に保存する。この段階では適用せず、人の承認後に実装・試験・監査・CI へ進む。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `req-to-openspec-skill`: REQ-136 の印を local のタスクへ限定し、最終の合格の条件を別の注記に示す。

## Impact

変更予定は root と配布先の AGENTS、delivery・req-to-openspec の Skill、tasks 雛形、README・guide・PR テンプレート、kit-assets・init・tarball の内容確認。CI・設定・判定・公開 API の振る舞いは変更しない。この PR の実働差分は計画文書と未適用パッチだけである。

## Non-goals

子の受入を C001 の完成とは扱わない。S1、親1.2の残り・1.3・2.2・4.2・4.4・4.5・5.1の残り・5.2と6/6の受入は残る。guide の旧 JSON と古い usage、docs/flow.md の「違いは3点だけ」の記述も残す。親と既存8子の全13 capability、子43 Requirement・140 Scenarioと親3 Requirement・11 Scenarioを縮めない。局所資料の13 Requirement・45 Scenarioを全体の範囲に置き換えない。

本番の同期・archive は6/6受入後。evidence→scope→quality→dod→parent の順と、S1 の先行受入・同期・archive を保持する。
