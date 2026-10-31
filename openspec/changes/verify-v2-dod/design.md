# Design

## Context

明示 scope と runner の local ゲートは実装済みである。動機は proposal の Why を参照。親1.2の REQ-136 と5.1の案内を切り出し、既存 Scenario と Source はバイト単位で保つ。

採用設計は Opus の最終結果と管理役の採用記録。R05 A・R06 A・R08 B は決定済みであり、再質問しない。DOD-Q1 A と DOD-Q2 A も trace に回答済みである。

## Goals / Non-Goals

ローカルの完了と最終 CI の合格を読む人が区別でき、印のタスクを runner が従来どおり扱えることを目指す。ci-gate、CLI、adapter、quality、公開 API、設定、必須チェックの条件は変更しない。親の残受入・S1・C001全体の範囲は proposal の Non-goals を保持する。

## Decisions

### 1. local の印と最終 CI の注記

tasks 雛形の印付きチェックボックスは `--done --scope local` とする。最終 CI の条件は fence 内末尾のチェックボックスでない注記に置く。fence の外に置くと生成後に落ちるおそれがあり、ci を別タスクにすると local の完了を ci に依存させるため、この案を採らない。

両 format は `pnpm -s verify` と `npx loomake verify` だけが違う状態を保つ。REQ-136 の元 Scenario と Source をそのまま残し、local と注記の新 Scenario を2件加える。元 Scenario を書き換える案は採らない。

### 2. 承認前は未適用パッチ

`proposed/implementation.patch` はデータであり、実働ファイルへ適用しない。`proposed/approval-request.md` に規則文・保護された expect の旧→新全文と凍結行を示す。人の承認後、採否と対象 patch の hash を trace へ記録して初めて実装へ進む。包括承認による技術回答を、新しい規則文と保護された期待値の個別承認に流用しない。

### 3. 行ごとの分類

正確な差分・旧文・新文・preimage hash は proposed の資料を参照する。root AGENTS の段階表と final CI、配布 AGENTS の禁止・報告・固有欄、delivery の計測定義、既存 CI の説明、生成 CLI ページ、guide の final CI 行は凍結する。ローカルで最後に実行する例だけに明示 local を足す。最終の合格には ci と必須チェックが別に必要と書く。

### 4. 保護された試験と追加検査

`kit-assets.test.ts` の既存 it 名、SKILL 指示の assertion、repo と配布の一致試験を保持する。承認対象の唯一の既存 expect は3.1のコマンドに明示 local を足す差分である。印の行数・位置、ci の checkbox 不在、fence 末尾の注記を追加で検査する。init の生成物と実 tarball も同じ内容を検査する。具体案は patch に含めるが、承認前は適用・実行しない。

### 5. Scenario 監査

既存 SCN-0c9a8c1de5d86a559154 の Scenario 本文と Source を保持する。監査用の canonical hash は Requirement 本文も含むため、契約が変わったあとに再計算する。旧 hash を新しい契約の監査済みの根拠として流用しない。承認後の実試験を確認してから、対応するテストブロックの hash と理由を更新し、新 Scenario 2件を監査する。この提案では scenarios.json を変えず、実行前の監査を reviewed にしない。生成・再照合の方法は proposed/approval-request.md に記す。

## Risks / Trade-offs

- 規則と雛形だけが先に適用される危険 → patch を未適用のまま提示し、人の承認後に試験と一緒に適用する。
- local の成功を最終合格と取り違える危険 → checkbox の外に最終 CI の必須条件を明記し、追加試験でも区別を検査する。
- 元資料の取り違え → immutable head の preimage hash と凍結箇所を記録し、適用直前にも照合する。

## Migration Plan

1. この計画と patch を独立レビューし、規則文と保護された期待値の具体的承認を得る。タスク1.2は承認まで未完了とする。
2. 承認済み patch を適用し、追加試験・init・tarball・Scenario 監査を実行する。未承認の修正が必要なら具体差分を改めて提示する。
3. lint・typecheck・全体試験と local 完了ゲートを通す。最終の ci ゲート、必須5チェック、3 OS、独立レビューの成功を別に記録してから子を受け入れる。
4. 親6/6受入後に evidence→scope→quality→dod→parent の整合を保って同期・archiveする。S1 は親6/6に先立ち受入・同期・archiveする。

ロールバックは具体差分を反転し、同じ検査と承認を通す。判定や CI の条件を緩めて戻さない。
