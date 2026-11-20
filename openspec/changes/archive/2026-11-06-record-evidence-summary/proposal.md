# record-evidence-summary

## Why

要件定義v0.11の7.9とW1-10（#69）は、要約・実行記録の本体・リリース記録を分け、本体をGitに複製せず要約から参照できることを要求する。現行Evidence 2は検証結果と文書のsnapshotを保存するが、実行条件の識別・本体の参照・取得と保持期間の検証契約がない。

## What Changes

- 通常L3の第一PRとして、REQ-460〜463の要約拡張版1と同期の意味検証、既存版を変えない公開スキーマ・型を追加する。
- 実行条件とCI識別、同じ実行のraw本体の観測照合、設定hash/nameRefsだけのコマンド参照、6分類の観測件数を扱い、未確認をnullと理由で表す。新しい書き手はrole development、外部本体は未アップロードとして記録する。
- kitに本体hash/bytes照合と、実保持期間・現在の期限切れを分ける純粋関数を追加する。
- initのquality.yaml雛形に、既存のevidence方針の既定値を明記する（REQ-396）。リポジトリ直下のquality.yamlは変更しない。

## Capabilities

### New Capabilities
- `evidence-summary`: Evidence 2に追加する要約拡張版1と、実行事実・未確認の理由・本体参照の契約。
- `artifact-reference`: 取得済みの本文の同一性と、保存期限の充足・失効を分けて検査する契約。

### Modified Capabilities
- `init`: REQ-396の雛形へ既存evidence既定値を明記する。既存5 Scenarioと配置・保護の契約を保持する。

## Non-goals

本PRだけでは親#69を閉じない。同じW1で未完了の本体参照の到達・索引・リリース記録形式・attempts・旧記録整理は、parent-handoff.mdに全量を保持する。共有先へ辿るQ69-04は限定手動CI＋immutable receiptの通常W1実装案を採用して未実装として保持し、上限を超える旧記録削除差分のQ69-07は未回答である。未アップロードを取得済みと表示しない。

このPRはアップロード・ダウンロード・CIジョブ・Gitコミット・ネットワーク認証・記録削除を実装しない。W2の必須gate自動化、W5のリリース生成・公開・長期転送、W1-14の履歴切出しへ範囲を広げない。W1の索引義務をW5へ延期したとは扱わない。

## Impact

coreの型・遅延構造スキーマ・別ディレクトリの生成JSON Schema、traceの記録と同期validator、kitの公開純粋関数・basisHash公開・init雛形、対応する試験と利用者文書が対象。既存12JSON Schema・型の公開元・未知欄・同期性・元の全assert・入力上限・品質設定・依存を保持する。#65の未受入APIと#71の候補APIは呼ばない。
