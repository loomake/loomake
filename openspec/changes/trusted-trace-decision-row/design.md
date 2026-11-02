# Design: trusted-trace-decision-row

## Context
Whyはproposal参照。main4612159を対象に新Opus af2924dd-195b-4011-95c0-9469ac15c942（claude-opus-5-5、ok:true、権限拒否0）が最小5aを設計した。[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6590095928)でQ-ROW-01はAに確定した（回答日11/2、作業日JST11/3）。

## Goals / Non-Goals
既存解析済みモデル内の記録値を照合する。raw文書、物理path、archive、行hash、出典URL分類、主体/API/本人承認、38行転記、Git来歴とS1は扱わない。常にadoptionsVerified:falseで、合成正例を実C001の成功に数えない。

## Decisions
私的なtrace-decision-row.tsへnamed exportを置く。coreの列定数は公開されていないため、既知9/7列を内部定数にしてT-ROW-06でparseTraceのキー集合と比較する。core exportsは変更しない。

```ts
findParsedTraceDecision(
  trace: Readonly<{ questions: readonly QuestionRow[]; assumptions: readonly AssumptionRow[] }>, id: string,
): { row: ParsedTraceDecisionRow | null; adoptionsVerified: false; problems: string[] }
```

id.trim()が空なら日本語の問題で拒否する。他のIDは変形せず、両表のrow.ID===idで選び、件数0/複数を先に拒否する。1件なら回答/承認のJS truthinessを既存evaluateAgreementと同じに見る。未知欄を許すRow型でも返却は既知セルとlineだけの閉じた型とし、未知欄を読み・コピー・拒否しない。新plain cellsとrowを凍結する。decision/actorLabel/dateはコピーから取り、空の記入者/非標準日付/否認を原文のまま返す。

問題は未取得、各表の件数を含む重複、質問の空回答、仮定の空承認の日本語1文。型契約外のProxy/getter/非文字列/unknownは検査せず、例外なし・一度だけ読む保証を追加しない。

## Risks / Trade-offs
モデルは文書全体の一意性・来歴・正式採否を保証しない。5bで元文書との損失のない結合と未決の受入方針を扱い、子6/7で主体・API・具体承認を照合する。部品成功だけを採否に使わない。

## 実装前のレビュー表
REQ390の全7 ScenarioをT-ROW-01〜06/08へ対応させる。REQ011/012/077/078/202/203、376/377/378/387/388/389と046/047、core/parser/公開exports・依存・CLI/JSON/run・設定・既存trusted試験/期限/skipは差分0。PIN/YAML bytes/15件数/47identity・158Scenario・46Source・16条件/14原文書/alias100/予算、親2Qの回答反映だけを許し、親実装・D38・S1の未完了を保持する。

## Migration Plan
本人回答を反映して仕様確定→strict/spec-only→新試験RED→私的部品GREEN→通常local done/CI/3OS/独立レビュー。src約43＋test約95＋計画・親回答・全記録・changesetを含め300行以内を見込む。300超なら受入を削らず設計で分ける。

## 採用済みの空ID拒否
Q-ROW-01はA。空文字・空白だけのIDは一致件数にかかわらず拒否する。非空IDのtrimや新しい文法、回答の意味・日付・主体の検査は追加しない。親やS1の全義務は残す。

## 空IDの既存根拠の照合
baseline-shape.tsのtext/adoptionRefはtrace.idにtrim().length>0を要求する。一方、REQ377の規範は採否参照の構造、archive design:32は非空の採否参照を定めるだけでid自体を明記しない。既存REQ377付き試験109〜111は空配列、327〜335はextra付き採否を拒否する試験であり、空/空白trace.idの直接試験ではない。AdoptionRefの型もid:stringで検証済みを区別しないため、既存実装だけを根拠に入力域や拒否を新規範へしない。この不足は実装からの推測で埋めず、後日の本人回答Aで確定した。
