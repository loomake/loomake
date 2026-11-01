# Proposal: windows-owned-cleanup-phases

## Why

Windowsで所有fixtureを停止する既存2試験の失敗について、PowerShell起動・CIM・所有者照合・taskkill・停止後の待ち・後片付けを区別できる記録を追加する。#275の原因を断定せず、元の品質判定と停止手順を保った診断材料を既存artifactへ残す。

## What Changes

- 予約済みREQ-363をADDEDとし、固定の区間と結果分類、欠測・不正・保存の完全性を定義する。
- 新しいプロセスやhookを使わず、コールバック版fsの同時1要求で順に追記する。48行・8KiBを上限とし、各試験の終わりの行を予約する。
- 元のPowerShell 13行と命令・例外・終了コード判定の順序を保持し、try内の印と最後のexit 0、既存2試験への診断呼出だけを加える。
- 停止対象PID・引数・CommandLine・raw出力・errorMessage・環境値は記録しない。自己PIDは既存と同じ行のpidとファイル名だけに使う。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `ci-test-diagnostics`: Windowsの所有fixture停止の区間記録を追加する。REQ-345と既存の全文・Scenarioは変更しない。

## Impact

`tests/helpers/owned-cleanup-phases.ts`、対応する新規回帰試験、`tests/delivery-ask-opus.test.ts`の印・省略可能な引数・既存2case内の挿入、`docs/dev/ci.md`が対象。製品package・markPhase・workflow・Vitest設定・期限・skip・旧assertは変えない。追加PowerShell probeは行わず、実Windowsの観測は後のCI既存2caseのartifactで行う。通常L3として仕様ゲート・完了ゲート・3 OSと必須CI・独立レビューを通し、受入後にarchiveする。
