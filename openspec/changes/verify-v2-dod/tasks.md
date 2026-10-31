# Tasks

この change は提案段階。規則文と保護された期待値は未適用であり、1.2の具体的承認までは実装へ進まない。

## 1. 仕様と承認

- [x] 1.1 子の計画・REQ-136全ブロック・trace・親の移管注記・未適用patchを準備する。spec-onlyとOpenSpec strictが成功し、正規パーサの本文が500 UTF-16以内、元ScenarioとSourceが同じで、保護対象の実働ファイルが不変であることを確認する（REQ-136）
- [ ] 1.2 proposed/approval-request.md と implementation.patch の規則文・保護された期待値の旧→新全文について、人の個別承認を得る。対象patchのhashと承認元をtraceへ記録して照合する

## 2. 文書と雛形

- [ ] 2.1 承認後、両format・両SKILLのlocalの印・末尾注記を反映し、kit-assetsの既存印試験と追加2Scenarioの試験、repo/配布の一致試験が成功することを確認する（REQ-136）
- [ ] 2.2 root/配布AGENTS・PRテンプレート・CONTRIBUTING・README両言語・cli README・flow・delivery・guide4箇所へ承認済み文を反映する。凍結箇所の照合と、AGENTSのDoD・init生成物・package-smokeの追加検査が成功することを確認する
- [ ] 2.3 kitとloomakeのpatch changesetを追加し、配布物の案内とtasks雛形が明示localになり、最終CIも別に必要と読めることを実tarballで確認する

## 3. 試験と監査

- [ ] 3.1 kit-assets:251を承認済み全文へ変更し、既存it名・他のexpect・印・SKILL指示・repo一致を保持する。追加のkit-assets/init/tarball試験を実行して成功と確認し、既存試験を削除・skip・緩和していないことを差分で確認する（REQ-136）
- [ ] 3.2 元ScenarioとSourceのバイトを保持し、契約を含むcanonical hashを再計算して、実試験を確認してから既存1件の対応試験hashと理由、新2件のScenario監査を更新する。正規の監査コマンドと独立レビューで対応関係を確認する（REQ-136）

## 4. ローカルの完了

- [ ] 4.1 lint・typecheck・全体試験・CLI参照の生成一致を確認し、`pnpm -s verify --change verify-v2-dod --done --scope local` がexit 0になることを確認する <!-- loomake:gate=done -->

注：4.1はローカルの完了だけである。最終の合格には、CIの `--done --scope ci` が exact 2.0.0・scope ci・completed・errors空・PASS・要判断なし・exit 0となり、必須5チェック・3 OSと独立レビューが成功が別に必要になる。これらはチェックボックスにしない。子の受入をC001の完成とは扱わない。

## Workflow follow-up

- 最終のCIとレビューの証跡を揃え、人の承認元を照合してからマージする。
- 本番同期・archiveは親6/6受入後。evidence→scope→quality→dod→parentの順と、S1の先行受入・同期・archiveを保つ。
- guideの旧JSON/usageは親5.1の残り。docs/flow.md:164の誤記は管理役が別Issueへ記録する。
