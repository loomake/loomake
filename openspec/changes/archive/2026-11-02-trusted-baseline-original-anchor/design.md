# Design

## Context
Opus初回6c8e28ecと追補342688b8の設計を使う。後者が全src走査を除外した。#310第3項の部分受入で、C2bの同期archiveはmain #335で受入済み。

## Goals / Non-Goals
新入口内部で原本確認成功値だけを後段へ渡す。実Git取得・指定A・Git監視・低位直呼び制御・S1/controller・主体・新実行は後続に残す。

## Decisions
新規 `anchored-baseline.ts` に次の2入口を置く。hashは `../hash.js` のsha256Hex、記録PINはC001_INITIAL_BASELINE_PINを内部で選び、引数にしない。
```ts
checkAnchoredInitialBaseline(input: unknown, snapshot: readonly GitDocument[], anchor: readonly Document[]): Result
checkAnchoredC001Record(text: string, snapshot: readonly GitDocument[], anchor: readonly Document[]): Result
```
各原文書のfile/text/oid/modeを一度だけプレーンなobjectへ写し、そのコピーをverifyOriginalSnapshotへ渡す。失敗時は原本のproblemsだけでnull/null/falseを返す。成功時だけ返されたdocumentsを使い、既存の構造/recordを呼んで結果をそのまま返す。
anchorは既存Document[]のまま。型付き通常データを受け、一般的なgetter/Proxyの安全性は保証しない。既存の件数・型・入力上限の拒否と日本語problemsを保持し、新たな例外処理を足さない。

## Risks / Trade-offs
- raw入力のmode/blobは申告値であり、Git由来・指定commit・所有文書の来歴を保証しない。
- 低位APIは既存試験とともに残る。全src走査・brand・呼出し監視は作らず、#310第3項はS1実接続まで未チェック。
- T-ANC-02/03の対照は実装前に実測する。成立しなければ試験を弱めず設計へ戻る。

## Migration Plan
仕様ゲート→改変原本と追従index/EOF改変の低位成功対照→2入口→T-ANC-01〜07→通常done/独立レビュー/必須CI/3OS。重い全件は管理役と調整する。

## Review invariants
REQ-389の6ScenarioとT-ANC-01〜07。REQ376/377/387/378、全14文書、47/158/46/16、C001 PINと15件数、既存src/試験/期待値/期限/skip/予算/エラー、公開exports/CLI/JSON/依存/設定を不変とする。REQ388子や共有ファイルにコード依存・編集をしない。

## Open Questions
Q-ANC-01〜08はtraceで管理役の技術判断を記録した。新たな仕様の曖昧さが出たときだけ未回答へ戻して止める。
