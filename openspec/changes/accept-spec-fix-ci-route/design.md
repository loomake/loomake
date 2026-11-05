# Design

## Context

動機と変更範囲は proposal.md を参照する。Opus が main の ci-gate と直接呼出側、既存 REQ-343、試験、規約を読み、設計した。新しい依存やワークフローの変更は要らない。

## Goals / Non-Goals

条件の収集と判定を `scripts/ci-spec-fix.mjs` に分け、既存 L3 の拒否分岐からだけ使う。L1・L2 と change のある L3 の処理は変えない。公開契約の不変性と RED/GREEN の実行証拠はレビューで確かめ、構文の検査だけで完了扱いにしない。

## Decisions

- `loomake-route:` は全行を読み、すべてが spec-fix のときに受け付ける。大文字小文字は既存 none と同じく区別しない。`loomake-req:` は全行をカンマで分け、前後の空白を除き、完全一致する REQ ID を重複なく集める。空値や不正値は理由付きで拒む。
- 主仕様の `spec.md` にある Requirement の Source だけを読む。進行中の差分仕様やフェンス内の記載は数えない。閉じフェンスの info string を正しく除いてから既存 `parseRequirements` を再利用する。
- git の raw diff が返す変更前後のパスを読む。削除を含め `openspec/` が一つでもあれば拒む。test の対象は vitest が実行する `tests/**/*.test.ts` と `packages/*/test/**/*.test.ts`。
- 既存 `extractTestBlocks` で it/test 呼出の名前と本文を読む。追加または変更された呼出に含む名前の `[REQ-xxx]` だけを数える。ファイルの名前を変えただけ、コメントや文字列内の偽の呼出、削除は数えない。直接の skip・todo・skipIf・runIf は除く。
- 基準は同じ PR の merge-base と HEAD の git blob。M/R/T で変更前を読めなければ失敗とする。コメントだけに REQ ID があっても通さない。主仕様や試験の読取失敗も通さない。
- 各不足理由をすべて返し、既存の L3 change 必須メッセージに添える。条件成立時は既存 L2 と同じ品質コマンドを実行し、品質の終了コードと工程検査の失敗を保つ。
- REQ-343 の既存 Scenario は全文保持する。本文は L3 の一文だけを変更し、細かい条件を Scenario へ置いて 500 字以内に保つ。

## Risks / Trade-offs

- ブロック内の空白やコメントだけの変更、既存試験をコピーした追加も変更と数える。実際の修正前失敗・修正後成功の証拠を PR 本文で確認する。
- describe.skip などの親の条件や、公開契約の意味は機械では判定しない。独立 Opus と管理役がレビューする。
- 行単位の宣言は既存の change 宣言に合わせ、Markdown フェンスを区別しない。Git パスは既存どおり大文字小文字を区別する。

## Migration Plan

この change は通常の L3 で受け入れる。main マージ後にだけ spec-fix を利用する。公開 API と package の配布物は変えない。

## 最終レビュー後の文書反映

利用者の 2026-11-05 の直接選択を承認元として、指定 W1 案件の起票制限の一時除外と A20 の W1 受入範囲を ADR 0006 に追記し、delivery スキルから参照する。これは承認済みの運用規則の反映で、A20 の実装・製品仕様・試験は #70 が所有する。REQ-343 の差分と CI のコードは変えない。

Opus R1 の軽微 2 件は CI ガイドの文書だけを修理する。options 形式の skip・todo と fails を必須レビュー項目に加え、単発 timeout の段落が #430 の文言の修理を兼ねると明記する。最新 main との統合差分・規則文書の追記・この修理をまとめて次の独立レビューへ渡す。
