# Proposal

## Why

既存REQ-154はrunnerの停止理由を表示前に置換するが、開始前のGit失敗は例外としてCLIへ渡り、保護を通らない。原文保存の契約を持つtraceや未完のcollectorへ広げず、この2経路だけを修理する。

## What Changes

- REQ-154の本文・旧2 Scenario・Sourceを保持し、既定の開始前Git失敗の表示を明示するScenarioを1つ追加する。
- GitErrorをUsageErrorへ変換する2か所で既存maskSecretsを使い、同じCLI入口の負例と通常診断の対照を追加する。
- REQ-199の規則、REQ-137のexit 2・記録なし、REQ-192の分類、他コマンドを保持する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`: REQ-154の既存停止理由保護を、開始前のGit失敗でも満たす。

## Impact

runnerの2行と追加試験が対象。公開API・CLI・設定・依存・旧試験を変えない。#65/W1-6・C003は着手/受入せず、依存未完を保持する。新L3 PRは本数条件で保留し、今回はローカル準備だけを行う。
