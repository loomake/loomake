# verify-archived-change-done

## Why
S2で実装PRにarchiveを含めると、active固定のCI/verifyが完了ゲートを実行できない。

## What Changes
- 本文明示のarchiveを一意解決し、元repoの通常doneと隔離入力による外部strictを実行する。

## Capabilities
New Capabilitiesはなし。Modified Capabilitiesはverify（REQ-394）とmonorepo（REQ-132）。

## Impact
kit/CIと新規試験。標準rootの必要修理に限り、設定・依存・既存TEST/PIN・一般finder・run/recordを変えない。
