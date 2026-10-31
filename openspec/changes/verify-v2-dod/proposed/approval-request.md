# 具体的な承認依頼と結果

この文書は管理役が Issue #121 へ提示する資料である。R06の規則移行は既承認で、新たな人の判断は tests/kit-assets.test.ts:251 の具体的な旧→新 expect だけである。この期待値1行は利用者が個別承認した。承認元・日時・patch hashは trace.md に記録した。以下の旧新全文と提案時点の検証範囲を保持し、実装後の結果は別に記録する。

## 採否を求める対象

採否を求めるのは、下記 tests/kit-assets.test.ts の元251行目の旧→新 expect だけである。[R-C001-06 A の承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324)は local DoD・最終ciの区別と規則・案内・両雛形・REQ-136の移行を承認済みで、個別承認を要するものをこの期待値の具体差分としている。

周辺の AGENTS・delivery の全文と、雛形・案内・追加試験を含む全 patch は、既承認の移行との整合をレビューできる資料として残す。これらを新たな承認対象にはしない。R05 A・R08 B と DOD-Q1 A・DOD-Q2 A も回答済みである。

## AGENTS.md

### 元の 32 行目

旧：

```text
4. change があれば、完了したら **完了ゲート** `pnpm -s verify --change <change-id> --done` を通す
```

新：

```text
4. change があれば、完了したら **完了ゲート** `pnpm -s verify --change <change-id> --done --scope local` を通す。最終の合格は PR の CI（gate ジョブの `--done`、scope は既定の ci）と必須チェックで確かめる
```

### 元の 43 行目

旧：

```text
- `pnpm -s verify --change <change-id> --done` が exit 0
```

新：

```text
- `pnpm -s verify --change <change-id> --done --scope local` が exit 0（ローカルの完了）
- 最終の合格：CI の gate ジョブで `verify --change <change-id> --done --scope ci` 相当（scope 省略時の既定）が exit 0。gate が JSON の 2.0.0・scope ci・run.status completed・errors 空・verdict PASS・要判断なしを確かめる。加えて必須 5 チェックが成功している。ローカルの完了だけで完了と報告しない
```

## .agents/skills/delivery/SKILL.md

### 元の 85 行目

旧：

```text
完了ゲートが必要な作業は、対象 head での成功を確認する。独立レビューは必須 CI の完了を待たずに始めてよい。CI が失敗したら原因を修正して再検証し、変更後の head を段階の回数の範囲で再レビューする。差分を変えずに再実行する場合も、原因と再検証の結果を記録する。変更範囲外の原因は Issue に記録し、必須 CI の成功を確認するまで対象 PR を保留する。
```

新：

```text
完了ゲートが必要な作業は、対象 head でローカルの完了（`--done --scope local`）と、gate ジョブの完了ゲート（scope ci）の成功を確認する。独立レビューは必須 CI の完了を待たずに始めてよい。CI が失敗したら原因を修正して再検証し、変更後の head を段階の回数の範囲で再レビューする。差分を変えずに再実行する場合も、原因と再検証の結果を記録する。変更範囲外の原因は Issue に記録し、必須 CI の成功を確認するまで対象 PR を保留する。
```

### 元の 92 行目

旧：

```text
4. 完了ゲート、tasksの完了、Requirementとテストの対応を確認し、段階に応じた独立レビューを依頼する。changeの一部を出すPRでは、その範囲の検証と残作業を明記し、change全体の完了を宣言しない。
```

新：

```text
4. ローカルの完了ゲート（`--done --scope local`）、tasksの完了、Requirementとテストの対応を確認し、段階に応じた独立レビューを依頼する。changeの一部を出すPRでは、その範囲の検証と残作業を明記し、change全体の完了を宣言しない。
```

### 元の 125 行目

旧：

```text
管理役は実装 PR のマージ時に、対応する change の全タスク・完了ゲート・要件対応テスト・レビューの完了と、実装が main に入ったことを確認し、[仕様同期](../openspec-sync-specs/SKILL.md)と [archive](../openspec-archive-change/SKILL.md) の手順へ続けて進む。一部だけを受け入れた change は、残りを完了扱いにしない。
```

新：

```text
管理役は実装 PR のマージ時に、対応する change の全タスク・CI の完了ゲート（scope ci）・要件対応テスト・レビューの完了と、実装が main に入ったことを確認し、[仕様同期](../openspec-sync-specs/SKILL.md)と [archive](../openspec-archive-change/SKILL.md) の手順へ続けて進む。一部だけを受け入れた change は、残りを完了扱いにしない。
```

## tests/kit-assets.test.ts

### 元の 251 行目

旧：

```text
    expect(format).toContain('- [ ] 3.1 `npx loomake verify --change <change-id> --done` を通す <!-- loomake:gate=done -->');
```

新：

```text
    expect(format).toContain('- [ ] 3.1 `npx loomake verify --change <change-id> --done --scope local` を通す <!-- loomake:gate=done -->');
```

## 凍結する箇所

source-integrity.json の frozen に行範囲・全文・sha256 を記録した。root の段階表と他の DoD 条件、配布側の禁止・報告・固有欄、README の既存 CI、delivery の計測定義、guide の最終 CI、kit-assets の既存 it 名と SKILL 指示を保持する。生成 CLI ページ、runner、設定、CI 条件、既存 Scenario 監査のファイルは丸ごと変更しない。全変更予定ファイルの旧 hash と新 hash も同じ資料にある。

## 追加する検査の具体案

全文は implementation.patch に含む。既存の expect は上の1行だけを変更し、既存のテストを削除・skipしない。

- kit-assets の REQ-136 試験は、tasks fence に印付きの local 行がちょうど1行あること、ci の checkbox が0行であることを検査する。
- 新しい REQ-136 試験は、fence 末尾の空でない行が注記であり、明示 ci・exit 0・PASS・要判断なし・必須 CI を含むことを検査する。
- ID なしの AGENTS 試験は local と ci の両条件と必須チェックを確認し、無指定 `--done` が DoD にないことを検査する。
- 既存の runInit helper を使い、実際に生成した AGENTS と Claude/Codex 両 Skill の local・印・最終注記を検査する。initFiles の返却内容だけを検査する案より、ファイルへの配置も確認できる。
- package-smoke は実 tarball で init した直後に同じ生成物の内容を確認する処理を追加する。既存の存在確認・v2 CI の PASS・配布契約の検査は残す。

## 承認後に実行する検査

`pnpm lint`、`pnpm typecheck`、`pnpm test`、`node scripts/generate-cli-reference.mjs --check`、配布 smoke の prepare/check を既存 CI と同じコマンドで実行する。対象ファイルのテストを先に実行してから全体へ進む。local の `pnpm -s verify --change verify-v2-dod --done --scope local` と、最終の ci ゲート（exact 2.0.0・scope ci・completed・errors 空・PASS・decision.required false・exit 0）、必須5チェック・3 OS・独立レビューを別々に記録する。この提案段階ではこれらの実装後の試験を実行していない。

## Scenario 監査の方法

元 SCN-0c9a8c1de5d86a559154 の scenarioSha256 は `a87d8729c33e2d095a74de3c8dacc6adeabf51a0695054c6b91b50f5fd18113e`。元の Source と Scenario は変更しない。ただし正規監査の hash は Requirement 本文も含むため、新契約では再計算が必要である。旧 hash を新契約の監査済みの根拠に流用しない。静的な候補は scenario-plan.json の planned に記録した。

旧の対応試験ブロック hash は `00881c55bfad1a79efb1d9a3129f20531b759d410d7847260a643c06f8e49f25`。承認後の実試験の結果と追加 assertion を確認してから、scripts/scenario-audit.mjs の inventoryScenarios と試験ブロック読取処理で hash を計算し、対応関係と理由をレビューして既存1件の契約を含む Scenario hash と試験の対応を更新する。

新2件（「印のタスクはローカルの完了ゲート」「最終の合格を区別する注記」）の項目も同じ手順で追加する。

主仕様へ同期した最終状態と実試験レポートに対し `node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json <試験レポート>` で再照合する。change中の新2件はそれまで pending のまま扱う。提案には生成済みの reviewed 行を含めない。

## 未達の受入と残作業

R06の規則移行は既承認である。251行の期待値1行は個別承認済みで、task1.2を完了した。実装・検証タスクは各結果を確認してからチェックし、最終CI・レビューまで子の受入と製品の完成を主張しない。親5.1の形式移行・tarball・公開型・CLI 基準・REQ-190 の残りと、S1・親6/6は引き続き必要である。docs/flow.md:164 の誤りは管理役が別 Issue へ記録し、guide の旧 JSON/usage は親5.1に残す。

## 適用前の照合

source-integrity.json の base と各 preimage、R06の既承認出典を照合し、251行の期待値の承認元と対象 patch の sha256 を trace に記録する。main の診断変更を取り込む必要があれば、同じ preimage を確認してから通常の手順で取り込む。新しい差分を未確認でこの承認に含めない。
