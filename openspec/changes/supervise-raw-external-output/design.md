# Design

## Context

動機はproposal、振る舞いはREQ-412の4Scenarioによる。基準はmain `7d7f69b5`。process.tsのrunExternalは同期spawnSyncのBufferをUTF-8へ変換し、監視結果・保持役・中断状態を扱う。process.test.tsには共有予算、子孫停止、保持役の実試験と既存60秒設定がある。

## Goals / Non-Goals

私的入口までをX1として実装する。X2のstream別上限、X3aのGit接続、X3bのstderr分離、general FS、collector、単独時計を追加しない。X3bのstderr16MiB・size+16MiB合計は未採用の技術案であり、要件や承認済み仮定にしない。X1でC3・S1・C001は完了しない。DOC01〜03やmetadataのREQ-405受入を前提に加えない。

## Decisions

- process.ts内に私的なnamed export `runExternalBytes(command,args,{cwd?,env?,timeoutMs?,maxBuffer})` を置く。maxBufferは必須。戻り値はstatus・signal・Bufferのstdout/stderr・任意errorとし、公開barrelや公開ExternalOptions/ExternalResultは変えない。
- 現行runExternal本体を共通engineへ移し、元Bufferと現行どおり制限した文字列の両方を保持する。両wrapperは共通結果から必要なfieldだけ返す。公開wrapperはraw fieldを除去し、成功時のerrorなしと実エラー時のerrorありを保つ。raw成功を文字列から再符号化しない。監視役・ProcessLimitErrorの文字列・cleanup・holder待ちの予算除外・共有中断状態・同期性は共通処理に残す。
- 公開captureは現行の `Math.max(maxBuffer,64*1024)` を維持する。私的captureだけ `maxBuffer+64*1024` とし、既存fd3制御用の親の余地を予約する。監視役へ渡すstdout+stderrの上限は元のmaxBuffer。私的上限と加算結果を安全な整数として起動前検査し、表現不能なら既存の入力検査と同じUsageErrorにする。公開上限へ追加制約を課さず、別の数値閾値は作らない。
- 制御領域を使い切るnative ENOBUFSは既存result.error分岐へ渡す。ENOBUFSから成功・出力制限を捏造する案は採らない。公開の上限ちょうどの疑いは未再現であり、今回の修理やIssue追加に含めない。

## 実装前のレビュー観点と試験

Requirement一覧はREQ-412のみ。追加テスト名に `[REQ-412]` を付ける。既存process.test.tsへ追記し、fixture・call・aliveと現在のtimeout設定を再利用する。module namespaceのReflect.getで私的入口を得て、旧sourceへのREDはimport失敗でなくassertionとして観測する。

| Scenario | 実際の観測と試験の配置 |
|---|---|
| 原文 | 両streamにBOMと不正UTF-8を含むBufferを書かせ、Buffer型と全バイト一致を確認する |
| 出力上限 | 合計65536バイトのstatus 0・errorフィールドなし、65537バイトの実ProcessLimitError.kind=outputを確認する。不正上限・省略・安全加算不能はfixtureの起動印がないUsageErrorをparameterizeして確認する |
| 期限・中断 | 既存withProcessBudgetで期限切れと公開操作による中断を作り、私的入口のエラー種別と起動印なしをそれぞれ確認する |
| 区別・公開範囲 | ENOENTのerror.code、通常status 7とraw両出力・errorフィールドなし、制限例外を区別し、package barrelに私的入口がないことを確認する |

破壊禁止は公開runExternalのAPI・型・文字列化・error有無、REQ-180〜183/250/252〜257/333の既存assertion、保持役と子孫停止、依存境界、core/kitの公開export、設定、既存timeoutとskip。旧full suiteを同じ条件で通し、追加試験の全体を旧sourceへ当てたREDも残す。試験圧縮や準備だけの分割で4Scenarioを落とさない。

## Risks / Trade-offs

[親のnative捕捉がfd3も数える] → project実験ではNode24/Linuxでstdout4+stderr4はcap6でENOBUFS・8で成功、fd1/2/3各4はcap10でENOBUFS・12で成功した。Node22や他OSの実測済みとはしない。実装後に通常のCIと3OSで確かめる。64KiB予約も無限の制御データは保証しない。
[共通化による公開結果の変化] → raw field除去とerrorの有無を明示し、既存試験を保持する。native障害も既存の停止・解放分岐を共有する。

## 変更量と受入順

計画6ファイルの実際の行数を確定後、source・testの追加と削除、同期、日誌、changeset、archive移動を含めて数える。初期見積はprocess.ts +34/-8=42行、既存process.test.ts +70/-0=70行、日誌6行とchangeset5行=11行。archiveは同一内容のR100移動として重複計上しない。確定した合計は下表に記す。

| 対象 | 行数 |
|---|---:|
| 計画6ファイル | 140 |
| 主仕様同期（差分ヘッダを除く） | 20 |
| source・test・日誌・changeset | 123 |
| 合計 | 283 |

300行を明確に超える見込みや4Scenarioの試験不足が判明したら、実装を広げず管理役へ戻す。normal local done、同じ実装PRでの主仕様同期とarchive、archive後のdone再確認まで行う。最終headで必須CI5件とkitのLinux/macOS/Windows、非作者レビューと独立Opus最終レビュー重大0・軽微Issue化を確認し、mainへのsquash直前にheadを照合する。照合後のpushは全条件を再確認する。
