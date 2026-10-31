# 承認時の提案資料

このディレクトリは、元251行の期待値1行を承認するために用意した差分と、提案時点の検証記録を保持する。`implementation.patch` の36732 bytesとsha256 `258a599353e3afa43b20409b20db0396d7dad3b200b88c08cf4415aae80dc275` は変更していない。

`source-integrity.json` の pending・noAppliedTests と `validation.json` の proposalOnly・patchApplied・notRun は、提案時点の記録である。現在の承認元と実装状況は `../trace.md`・`../tasks.md`、実試験に基づく Scenario の対応は `../audit/` を参照する。`scenario-plan.json` は静的な候補のまま残し、実監査の結果で上書きしない。

実装時は承認済みpatchの全後像26件と凍結17範囲を照合した。その後、実試験と内容レビューに基づき、主仕様の旧 Scenario 1件の対応試験と理由を更新した。旧契約の Scenario hash は保持し、新契約の hash は子側の監査表だけに記録する。主仕様のファイルは本番同期まで変更しない。
