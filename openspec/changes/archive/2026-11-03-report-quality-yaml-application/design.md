# Design

## Context

main 7d7f69b5 起点の計画。元 B2 checkpoint 13e9817e の REQ-411 の同一設計成果を移管する。先行 Apply（計画 551d959a、実装最終 head は後日固定）は Y 以下を含む将来の local 依存で、未 main である。

## Goals / Non-Goals

本文・全二 Scenario・台帳行を byte 移管し、旧報告へ追加情報を届ける。既存 Opus e8d1395f と採否評価の配分だけで、意味論・ID・全 assert を変更しない。Apply→Report の最終受入順と許可済み local 先行を守る。

## Decisions

元 checkpoint の両 Skill Step 7 の各六行をそのまま追加し、元 REQ-411 root 二ケース全文を Apply が持つ同じ describe に置く。report 用 const 一行と二ケース六行を加え、追加報告の未実装分は RED、旧四項目・次の一手の互換は PASS として確かめる。独立レビューの観点は全二 Scenario と全 assert 保持に固定する。format・kit 試験は変えない。

## Risks / Trade-offs

Apply 最終 head を固定して取り込み、固定親基準で自身の差分を確認する。Step 5 の合意更新・対象外保持・停止条件・不在全文、出典有値・target/context 実定義・旧 evidence・六分類・旧三表・旧字句を保つ。値や出典の創作・追加承認・API/runtime・依存・設定変更はせず、静的例 parse を loaded・実生成・人判断の成功にしない。同じ PR で通常 done・同期/archive、main 後再確定・非作者/独立レビュー・必須 CI/kit 三 OS を確認する。
