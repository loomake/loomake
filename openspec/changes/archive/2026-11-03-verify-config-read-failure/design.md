# Design

## Context
C001 design.md:27/33/86と#61の採用済み契約を修理する。現mainの実EACCESはconfig/2で、JSON構文/内容2と不在defaultは既存動作。Opus設計35160484-aeb6-4b6c-8c96-7bb305cb1451（claude-opus-5-5）を利用する。自己レビューC1/C2/m1は補足設計4f552c6c-83e5-4b69-9272-a36df88d0cfe（同モデル）で修理する。

## Goals / Non-Goals
OS読取失敗だけverifyでruntime/3へ分ける。公開JSON・exports・依存・他コマンド・入力予算と拒否条件は変えない。

## Decisions
- 内部InputReadFailureをUsageErrorのサブクラスとして追加し、InputReader.readのOSエラー経路だけで使う。メッセージとUsageError互換を保ち、indexへexportしない。readHead/entriesとfinallyのcloseSyncの扱いは変えない。
- loadConfigのreadとJSON.parseのcatchを分け、readの内部識別を保つ。runVerifyだけがInputReadFailureをRuntimeFailureへ変える。入力上限・リンク・非通常fileと構文/内容は従来config/2。
- 共有loadConfigのexistsSyncは保ち、内部loadVerifyConfigだけlstatで存在を確認する。ENOENT/ENOTDIRは不在、他の照会OS失敗はInputReadFailure。共通readConfigへ存在判定を渡し二度確認しない。原設計A02の除外は未達を残したため撤回する。
- API/CLIの注入先は実パスへ合わせ、共有利用側のgiven表記は保持する。全OSでopenSync/lstatSync/existsSyncを対象pathだけ注入し、既存15例と追加8例を確認。Linuxの親/実ファイルchmod、リンク競合、alias rootの実測を分け、新しいskip/runIfや他OS実権限の観測主張を加えない。
- 上の境界は管理役が既存契約を保持する技術判断として確認した。新しい人の採否・未回答事項はない。

- readのELOOP（O_NOFOLLOWのリンク拒否）はUsageErrorへ分け、config/2を保つ。readHead/entries/finally closeSyncの分類は変えない。

## Risks / Trade-offs
共有例外の種類を変える影響は、直接loadConfig・doctor・trace record・runnerと既存入力試験で確認する。不要な公開引数や文字列による原因推測を避ける。

## Migration Plan
changesetと互換性文書で読取不能2→3、入力拒否/構文/内容2、不在defaultと他コマンド維持を示す。REQ394受入後に自身だけ同じPRで仕様同期/archiveし通常doneを再確認する。
