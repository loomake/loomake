# Design: fix-dependency-table-delimiters

## Context

基準は main #400（7d640808）。normal Opus 設計28257774の採否はtraceに記録する。動機と範囲はproposal、全契約はspecs/verify/spec.mdを参照する。

## Goals / Non-Goals

REQ-400の構文修理と日付訂正だけを行う。C1b候補b746608eのerrors優先24例は未mainであり、m3・CLI変更を混ぜない。core readTableは区切り内容を検証しないため、変更の根拠にしない。

## Decisions

- Q-DLM-01=A。`dependencies.ts` の `/^:?-{3,}:?$/` を `/^:?-+:?$/` にする。3個限定維持とセル内空白許容は採らず、列数7・trim・旧エラー位置を保持する。
- REQ-400の本文・Source・全5 Scenario・全THENは不変、WHEN 2行だけ形を明記する。新REQは設けない。
- 旧58例の全本文・期待・fixture・skip・5秒を保持し、同ファイル末尾へ既存helperで受付9例、CRLF/CR×全3kindの2例、無効セル9例、6/8列の2例を追加する。各例はREQ-400名と全戻り値・行・順序または構文エラー位置を検証する。
- 受付は空白なし`|-|`/`|:-:|`、`-`/`--`/`:-`/`-:`/`:-:`/`:--:`、7列混在。拒否は空/`:`/`::`/`- -`/`-=-`/`=`/`a`/`:-:-`/`+-`。旧sourceで受付と改行例のassertion REDを確認し、収集エラーを代用しない。
- 旧archive `2026-11-03-verify-dependency-declarations/trace.md` の8/9行の日付だけ11/3にし、7行目11/2と全リンク・版・他行を保つ。原コメント本文の回答日が根拠で、投稿時刻を推測しない。

## Risks / Trade-offs

- 正規表現の緩めすぎ → 無効セル/列数の全結果と旧58例を確認する。値・順序・エスケープ・フェンス・節終端・CHANGE_ID・archive/self拒否・errors併存は維持する。
- 記録の誤訂正 → 本人回答6591068404と整理6591563998の本文へ照合し、旧traceは日付2セル以外の差分0とする。
- 完了確認の循環 → tasksは実作業だけ、同期/archive/chsetをtrackedにした後の単一標準localdoneを必須follow-upとする。Opus原§4の自己参照checkboxと§5のfullgate2回は採らない。

## Review / Budget

独立レビュー観点はREQ-400全5Sc/旧58不変、全22追加例、WHEN2行/日付2セルだけの差分、CLI/core/設定/DoD境界、単一通常done実0と必須CI/3OS。全docs・同期・chset・日誌込165–175行を見込み、assert削除や行詰めで合わせず実数を数える。
