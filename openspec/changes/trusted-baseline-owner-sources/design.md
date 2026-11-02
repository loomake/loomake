## Context

[Issue #310](https://github.com/loomake/loomake/issues/310)、C1 archiveのQ-S1-14、Opus設計47168de9（2026-11-02）を採用する。実装はC2bの通常受入・同期・archive後に開始する。

## Decisions

`owner-sources.ts`へ同期の私的named export `checkC001OwnerSources(input: unknown, context)`を置く。contextは既存構造照合と同じoriginal・anchor・sha256Hex。必ず構造照合を先行し、失敗のproblemsを保持する。成功は凍結したbindings、失敗はnull、常にadoptionsVerified:false。Documentの純粋な本文照合で、Git由来は保証しない。

ownerBlockをexportしlogical・sourcesだけを結果へ追加する。archiveは既存規則でactiveの論理pathへ戻す。論理pathのcapabilityとkeyの末尾2要素を除いた部分を比較し、各行に原Sourceを持つownerを1件以上求める。

例外表はC001のコード定数からだけ選び、引数にはしない。REQ-100のmain-unchanged/file/name/block/4 Scenario/Source REQ-331をQ-S1-14どおり固定し、331タグ試験を求める。表は深く凍結し、未使用も拒否する。判断ラベルはC1 archiveのchange/idであり、trace実在・主体/APIの検証済みとはしない。

共有・同句排他を拒否/統合しない。既存構造が受理するactive/archive併存・複数archiveも個別に本文を照合する。未決は親traceに残し、この子は依存しない。

## Validation

T-C3A-01〜06で全6 Scenarioを対応させる。負例は構造照合なら通ることを対照にし、欠落・1字変更・nullでは元problemsを比較する。既存試験はバイト不変とする。

独立レビューの対象IDは388・376・377・378・387。原47/158/46/16、14原文書、PIN/15件数/409参照、038/042・114 Draft・205 O1〜O3・DUP324、旧試験/期限/alias100、公開exports・依存・JSON/CLIを保持する。379/380とS1の370〜375は所有しない。

変更見積りはsrc77・test105・計画110・親trace4・worklog4で約300行。重複説明だけを短くし、Scenario・試験・受入を落とさない。Git監視/確認済み原本・採否/API・新実行・S1/live/S2は後続である。

配布物に含むkitの私的部品にはpatch changesetを添える。最終タスクは既存runnerと同じく実行中だけ仮チェックし、ゲート失敗時に未完了へ戻す。成功前には完了と報告しない。
