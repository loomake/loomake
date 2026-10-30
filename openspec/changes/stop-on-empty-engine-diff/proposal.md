# Proposal: stop-on-empty-engine-diff

## Why

修正前の `d5aa30d` の `loomake run` は、エンジンが終了コード 0 で終わると、作業ツリーの差分の有無を見ずに、tasks.md のタスクを完了にしてコミットする（`packages/runner/src/run/phases.ts` の `runEngineTasks`）。権限が足りずに何も変えられなかったエンジンでも、tasks.md だけを含む `run(<change-id>): <タスク>` のコミットができ、タスクは完了として扱われる。その後の完了ゲートの直しも、差分がないまま直しの回数の上限まで繰り返す。偽のエンジンで再現した（`.loomake/repro/`）。

## What Changes

- エンジンが変更を残さず、変更不要の合図と理由も出さずに終えたら、run はそのタスクを完了にせず、コミットもせずに止まる（REQ-330）。
- 変更の要らないタスクは、エンジンが出力の行頭に `LOOMAKE-NOCHANGE: <理由>` を書いたときだけ、tasks.md だけのコミットで完了にする。タスクの指示に、この決まりを足す（REQ-330）。
- 完了ゲートの直しで、エンジンが変更を残さなければ、直しの回数の上限を待たず再検証せずに止まり、その直しの出力記録の具体パスを表示する（REQ-331）。
- 変更不要の理由は、既存の秘密情報置換後にC0/C1制御文字を可視化し、末尾の空白を含め、標準出力とコミット本文に同じ文字列を残す。監査JSONは既存の秘密情報置換を保ち、制御文字の原文を残す。変更不要のコミットだけ `--cleanup=verbatim` を使い、理由の末尾を保持する（REQ-339）。
- 変更の有無と合図から次の段階を決める純粋な判断を、run-decision-policy に足す（REQ-332）。
- 止まったときの状態は既存の `stopped`、終了コードは 1 とし、新しい状態の種別は足さない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`：差分のないタスク（REQ-330）、差分のない直し（REQ-331）、変更不要の理由の表示と記録（REQ-339）の要件を足す。REQ-099・REQ-100 に、変更がない場合の例外を反映する。
- `run-decision-policy`：変更の有無による純粋な判断（REQ-332）を足す。REQ-204・REQ-205 の優先順位は変えない。

## Impact

`packages/runner/src/run/{decision-policy,phases,prompt}.ts` と、runner の試験、`tests/run-decision-mutations.test.ts` を変える。既存の試験のうち、何も変えないエンジンでタスクを完了にしていた台本は、`LOOMAKE-NOCHANGE:` を出す台本に置き換える。期待値は変えない（仮定 A-04）。利用者向けの `docs/guide/` の usage と run-recovery に、合図と止まったときの対処を書く。`docs/quality/scenarios.json` には、この change の Scenario のレビューを足し、台本を変えた試験を根拠にする既存のレビューのハッシュを更新する。公開 API の型、設定のキー、依存は変えない。run の振る舞いが変わるので、`@loomake/runner` と `loomake` の changeset を足す。

変更不要の理由（REQ-339）は、端末とコミット本文では制御文字が見える文字列となり、末尾の空白も残る。監査JSONには、秘密情報置換後の制御文字の原文を残す。Gitの整形を変えるのは変更不要のコミットだけで、通常・直し・evidenceのコミットへは広げない。

既存の利用者で、エンジンが変更も合図と理由も残さないタスクがあった run は、このあと止まるようになる。

archive する PR では、この change の Scenario のレビューを、`openspec/specs/run/spec.md` と `openspec/specs/run-decision-policy/spec.md` 側の ID に移す。
