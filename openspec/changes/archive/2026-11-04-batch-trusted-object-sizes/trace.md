# Trace: batch-trusted-object-sizes

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| Issue #310 と `.loomake/size-batch-design/request.md`、Opus `2fca513f-e2b7-4f8a-8cd9-509e0b3d5dc0/result.md`、管理役による本作業の採否 | main 782d068b、normal 設計 | 2026-11-04 |
| `openspec/specs/trusted-baseline/spec.md`、user直接AGENTS・speed-plan-2、CI41751822212の原ログ | 同 main、既存契約と作業範囲 | 2026-11-04 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-418 | Opus 設計1–5節と管理役採否Q1–6 | 非機能 | 既定4値・適格な複数文書のsizeを一括照会し、戻り値・上限・拒否順を保持する。異常応答と通常完了非0は旧全ループ、ENOBUFS・中断等は停止 | 反映済 | specs/trusted-baseline/spec.md |
| REQ-376 | 現主仕様と管理役の旧契約保持指示 | 既存 | 固定Git・bytes/mode/oid・path・UTF-8/BOM・予算・拒否順を保持し、15既存試験のassert・期限・設定を変えない | 既存仕様で充足 | openspec/specs/trusted-baseline/spec.md |
| REQ-377 | 現主仕様と設計依頼B1/B5 | 既存 | 原14文書の全bytes/mode/oid、17原文関連例・2commit・既存5秒期限と採否未検証を保持 | 既存仕様で充足 | openspec/specs/trusted-baseline/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-418 | 要件と適用予算をどう置くか | A:418追加/376不変、同じ4値 / B:376変更、object同一性 | A。旧契約を保つ | no | 元Q1=A、Q2=B。418追加と4値一致を採用。main/known415–417/#121で418定義重複なし | 管理役（内部技術判断） | 2026-11-04 |
| Q-02 | REQ-418 | 異常応答・上限・操作失敗の扱い | A:全て伝播 / B:応答異常と通常完了非0だけ旧全ループ | B。batch固有の未対応optionでは旧-sが成功し得る | no | 元Q3=A/Q4=A/Q5=B限定採用。不正UTF-8/非ASCIIもfallback、ENOBUFSは既存上限error、signal/timeout/中断/起動失敗は即伝播 | 管理役（内部技術判断） | 2026-11-04 |
| Q-03 | REQ-376・418 | 適格判定と試験の段取りをどう置くか | A:純粋な全行判定、同PRでPASS→RED→GREEN / B:先行拒否、baseline別PRをmain依存 | A。旧拒否順を保ちCI待ちの循環を避ける | no | 元Q6=A。同一L3で376 PASS→418 RED→source GREEN。管理役は全量390–435行/目安405行を採用。#399と領域分割済み、baseline別PRのCI循環を避け、全5Scenario/既定合計等値/+1/非0/signal/UTF8を保持 | 管理役（内部技術判断） | 2026-11-04 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-418 | 正常な14文書の2読取は60→34起動、現fixture込67→41の静的見込み。Windows再発解消や平均時間は未確定 | #398自身CI成功後にmainの4例が5s timeout。自前readerの2例は対象外 | 承認：機能改善の範囲だけ採用。独立調査の代替としない | 管理役 | 2026-11-04 |
| A-02 | REQ-376・418 | user直接指示を優先し日別worklogと全日本語yomiyasuを使う。新実Git試験のみ初めから60s | 既存5s/期待/skip/設定は不変。Opusの既存11件と合計境界試験省略を訂正し15件・16MiB+1byteを検証 | 承認：旧契約の縮小なし | 管理役 | 2026-11-04 |
