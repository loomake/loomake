# Design

## 方針
Opus458b3bffの新規作成だけDraftとする案を採用する。createPrの引数末尾に--draftを足し、既存のbody-file位置を保つ。findOpenPrとrun/phasesは変えない。固定された親REQ-114には重複MODIFIEDを置かない。

## 採用しない案
archive単独の第2PRはS2に反するため作らない。仕様配置・既存エラー経路・本人施策2の受入基準を新たな回答待ちにしない。実GitHubと実engineは未観測と明記する。

## 実装前のレビュー観点
REQ-116/165の新旧全Scenarioと、REQ-100/114/115/182/211/315/317のlocal・記録順・期限・認証・再利用・JSONを保つ。既存argv完全一致は新仕様の--draftだけを加えた正確な期待でREDを先に確かめ、他のassert・skip・期限を変えない。

## 予算と受入
計画・全仕様・新回帰・既存完全一致の強化・source・usage・changeset・日別log・主仕様同期/archiveを含め約290行。実数で300を超えるなら実装前に意味ある単位へ分ける。通常done0・別担当自己レビュー・独立Opus・必須CI/3 OSを最終headで確認する。

## CIの阻害
現CI/verify/OpenSpecがarchiveを対象にできないため、同期/archiveを含む最終受入は技術修理後。none偽装・旧head成功代替・ゲート省略をしない。今回CI設定や規則は変更しない。
