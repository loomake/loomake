# Design

## Context

main 7d7f69b5 起点の計画。追加設計 7ff1f5fc と root の D4=A を採り、X の propose-quality-yaml（計画 67e17f4c、実装最終 head は後日固定）を将来のローカル依存とする。Issue 子・A を含め先行子は未 main である。

## Goals / Non-Goals

原 a470 の REQ-409 本文と二 Scenario をそのまま移管する。新 ID・追加承認・反映手順は作らず、旧 5d4a の誤根拠は採らない。最終受入順 X→Y→B2 と、許可済みローカル先行を両立する。

## Decisions

両 Skill の X の「品質 YAML の提案」小節の末尾に見出しなしで各二行を追加する。原 a470 の REQ-409 root 二件・六行を同じ describe の末尾へ全文のまま移す。独立レビューは二 Scenario の具体差分/新規全文/model と証拠不足告知、および X の五試験と旧 assert の維持を観点に固定する。format と kit 試験は変えない。

## Risks / Trade-offs

X 最終 head を固定・取り込み、ローカル親基準で自身の差分を確認する。出典有値・target・context 実定義・旧 evidence・六分類・旧三表・REQ-025〜033・055・059・136 を保持し、値や出典の創作、runtime/API・parser/schema・依存・設定の変更はしない。静的・実生成・人の確認を区別し、主仕様同期/archive と通常 done は同じ作業 PR、main 後再確定・非作者/独立レビュー・必須 CI/kit 三 OS は後続に残す。
