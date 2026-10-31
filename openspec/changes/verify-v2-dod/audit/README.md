# REQ-136 の実試験と Scenario の対応

この記録は、子 `verify-v2-dod` の差分仕様と実試験を対応させた監査である。主仕様への同期・archive と、最終 CI・独立最終レビュー・子の受入は済んでいない。

## 子の差分仕様の監査

`reviews.json` は、元の「雛形に印がある」と、新しい「印のタスクはローカルの完了ゲート」「最終の合格を区別する注記」の3件を記録する。Requirement 本文と各 Scenario 本文を読み、各テストの assertion が確認する条件を理由に記入した。成功した kit-assets と実 init の試験結果から、正規 `inventoryScenarios`・`blockDigest`・`auditScenarios` で再照合した結果が `result.json` である。単なる REQ-ID の一致や、hash の付け替えを対応の根拠にはしていない。

主仕様と同じ Scenario ID を求めるため、子の delta 全文に将来の canonical path `openspec/specs/req-to-openspec-skill/spec.md` を渡す。元 Scenario の ID は変わらないが、Requirement 本文も hash に含むため、旧契約の `a87d8729c33e2d095a74de3c8dacc6adeabf51a0695054c6b91b50f5fd18113e` を新契約の根拠に流用しない。新契約の hash はこの子のレビュー表にのみ記録する。元 Source と元 Scenario の301 bytesは保持し、sha256は `c3272f5353580a23953f4c9b1b011399742b78c075ef4d733d3447d753ddb8f7` と一致する。

再照合するコマンドは次のとおり。実試験レポートは、そのリポジトリ内で実行した Vitest の JSON を指定する。

```sh
node openspec/changes/verify-v2-dod/audit/replay.mjs .loomake/test-report.json
```

## 主仕様の元 Scenario の再レビュー

`docs/quality/scenarios.json` の元 Scenario 1件は、旧契約の Scenario hash を保持する。旧契約と元 Scenario の本文、新しい既存 it の全文を読み直した。承認された local オプションを付けても、旧 Scenario が要求する tasks 雛形の行末の印と SKILL 本文の指示を、同じ it が引き続き assert している。実際にその it が成功したことを確認し、選択条件を既存 it の名前に限定して、その本文ブロック hash と対応理由を更新した。他の旧 it・expect は保持し、追加2件を旧 Scenario の試験選択に混ぜていない。

## 本番同期後まで残る確認

正規 `scripts/scenario-audit.mjs` の repository 監査は、進行中の change を pending に分類する。子の実監査3件の成功を、repository 全体の成功や pending の解消とは扱わない。主仕様のファイルはこの実装で変更しない。

```sh
node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json .loomake/test-report.json
```

本番の同期・archive は親6/6の受入後とする。evidence→scope→quality→dod→parent の順と S1 の先行受入・同期・archive を守り、その時点の主仕様・実試験で子の3件を repository のレビュー表へ反映して再監査する。全13 capabilityの子43 Requirement・140 Scenarioと親3 Requirement・11 Scenario、S1を含む残受入は維持する。

## 独立した対応確認

管理役 root は、旧主仕様の1件、子deltaのRequirementと3 Scenario、既存itの全文、新2件のit、実initのit、対応理由と旧契約hashの保持を別に読んで照合した。管理役が次の再照合を実行し、子だけの3件が reviewed、invalid が0件、exit 0であることと `repositoryApplied: false` を確認した。これは最終 Opus レビューや repository 全体の監査を置き換えない。

```sh
node openspec/changes/verify-v2-dod/audit/replay.mjs .loomake/test-report.json .loomake/review-audit-independent.json
```

## 全体試験での再照合

local done内の全体試験は478 suiteが成功し、2093件成功・既存pending8件・失敗0件だった。同じ成功レポートで子の再照合を実行し、`result.json` を更新した。子の3件はreviewed、invalidは0件で、repositoryへの反映は引き続き行っていない。

正規repository監査も同じ全体試験レポートで実行した。結果は392件reviewed・240件unreviewed・71件invalidでexit 1となり、進行中のchangeはpending161件（うちこの子3件）である。旧主仕様の元Scenarioはreviewedを確認した。子の実監査とこの全体未達を区別し、親の受入まで全体監査の条件を保持する。

main aeee取り込み後にも、a72d5a53で開始し親移管注記3行の訂正後の0c0a024bで終了した実検証で485 suite・2134件成功・既存pending8件・local done exit 0と、同じレポートでの子3件の監査成功を確認した。

## CRLF修理後の監査

Issue #281の改行依存を修理し、LFとCRLFの実配布formatが同じ行配列・印1件・ci checkbox不在・末尾注記を満たす回帰を追加した。新2件のScenarioについて、元のassertionの条件を保つことと実init・改行回帰の成功を読み直し、必要な試験ブロックhashと対応理由だけを更新した。旧主仕様1件と子の元Scenarioのテストブロックは不変で、旧主仕様のScenario hashと試験hashを保持する。

上の478 suite・2093件と485 suite・2134件の結果は、それぞれの取り込み時点の履歴である。現在の `result.json` はCRLF修理後の実成功レポートで正規関数を再実行した結果とし、以前の記録はGit履歴に保持する。子3件の対応確認をrepository全体やWindows CIの成功へ読み替えない。

修理後の全体試験は487 suite・2190件成功・既存pending8件・失敗0件で、local doneはexit 0だった。この実成功レポートで正規replayを再実行し、現在の `result.json` は子3件reviewed・invalid 0・`repositoryApplied: false` を記録している。修理後headのWindowsを含むCIとOpus再レビューは別に確認する。
