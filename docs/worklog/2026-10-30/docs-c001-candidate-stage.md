# C001 設計候補文書の先行PR準備

1. やったこと：同じ `verify-v2-c001` task 1.2 のうち設計候補文書だけを先行する。main `085a826` を再取得確認し、bb88原文を保持した。管理役の追加承認により段階注記と後段予定の2参照の表示だけを調整し、空changesetを加えた。PRは未作成。正式change・ID・枠は増やしていない。
2. verify の結果：許可差分の機械照合、Git原文hash、差分範囲・文書参照・diffcheckを確認した。仕様・trace・tasks・主仕様・製品コード・試験・設定は変更しない候補文書の先行整備で、ADR 0005の境界に従い製品spec-only/doneはこの段階の合格として実行・報告しない。後段規範PRでstrict/spec-only・保持確認を新headで実行する。
3. 残っている確認事項・仮定：候補本文にある承認済み方針の履歴は保持するが、規範specs/trace/tasksの受入は後段であり、task 1.2とC001 DoDは未達。必須CI・自動Codex・独立Opus最終レビューは未実施。S1/S2の実装は始めていない。
4. 次にやること：管理役へ現行契約と未受入bb88規範の比較資料を渡し、PRとレビューを進める。後段規範PRでdesign.mdの両節が実在する状態になったら、候補本文とリンク表記を元bb88へ戻す。旧60dc・S1・bb88のworktree/branchは変更しない。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 未作成（C001候補文書の先行段階） | 未測定（旧設計を再利用） | 進行中（固定head確認前、製品実装なし） | 未実施 | 未実施 | 未実施（PR作成前） |

計測対象は本記録を含む候補文書の先行段階で、原文は `bb88fe238ab0254e34d25dd8caeb19e8d0155cc4`、baseは `085a82686dc1c14506fbdbad88b5b9b3961f522e`。2026-10-30 22:15:29 JSTにremote mainがbaseと一致することを確認した。PR作成後の計測と固定headの証跡は管理役のPR本文へ記録し、マージ後の値は次の作業PRで参照追記する。週次定期実行は未設定で、配布全体も未完了。

## 初回レビュー後の候補文書修正

1. やったこと：PR [180](https://github.com/loomake/loomake/pull/180)の初回head `8fc40c64d1ffadac36c56f7050d9b813bcfefb20`を全10工程でレビューした。元の報告件数は重大7・軽微27・情報20で、工程間の重複と問題なしの確認を含むため、修正箇所数とは異なる。反復した状態表示の指摘は[Issue182](https://github.com/loomake/loomake/issues/182)に記録した。管理役の追加承認により、候補本文の時点区分・承認経路・既存assertion移行表と保持条件を補足した。規範specs・trace・tasks・design.md、主仕様、製品コード・試験・設定は変更していない。
2. verify の結果：初回headのCI [41064487006](https://github.com/loomake/loomake/actions/runs/41064487006)は成功した。quality jobのdocs-only分岐では品質手順をskipしたが、gate jobはlint・typecheck・testを実行し成功した。CodeQL [41064487829](https://github.com/loomake/loomake/actions/runs/41064487829)も成功、自動Codexは同headで完了・指摘なしだった。この実績を修正後のheadやC001のspec-only/done成功へ流用しない。候補文書だけの修正に対する差分・原文・保持・参照検査は別途記録する。
3. 残っている確認事項・仮定：Report2の射影A（v2のci/PASSかつ要判断なしのみok:true）とbare skip不足1/commands未設定0の明記は、管理役が採用した。回答者は「利用者（ADR 0006 の包括承認）」で、理由はREQ316との一致、Report2の現型・旧原本の保持、旧補足R12とbb88 REQ191/312との整合である。Markdownのlocal完了表示、公開APIとJSON roundtripの両立は技術設計前であり、S1/S2やtask1.2を完了扱いにしない。[Issue170](https://github.com/loomake/loomake/issues/170)・[Issue172](https://github.com/loomake/loomake/issues/172)はIssue182と別に追跡を保持する。
4. 次にやること：未確定の技術境界を具体化し、新headで文書検証・CI・自動Codexと全工程の独立最終レビューを受け直す。後段規範PRでは元bb88をそのまま復元するだけにせず、今回の意味の整合と移行具体化を保って統合し、strict/spec-only・全Requirement/Scenarioの保持を新headで再確認する。両段階が受け入れられるまでtask1.2は未完であり、S1/S2の製品実装は始めない。

旧補足設計の実施事実も保持する。旧作業木のhead `218f7150eab2a04b26e46db7a1bd3fc04eef6448`で、session `9b8c1bd2-3fed-4ee8-bf9b-19ccd818552b`（441686ms）と `4b757858-2041-4eca-abf1-796e3287c37b`（331635ms）は、ともに実モデルclaude-opus-5-5、design、ok:true、Read/Glob/Grepのみ、MCPなし、権限拒否0だった。採用記録は旧ローカルcommit `bb88fe238ab0254e34d25dd8caeb19e8d0155cc4` の `openspec/changes/verify-v2-c001/design.md` 補足節と同commitのtraceにある。このローカルcommitを公開済みの参照先とは扱わない。今回その規範差分をまだ移していないことと、補足設計そのものを実施したことは別である。原manifestのSHA256は順に `4942460b02d343a09cbb6287797a3127bd5748f10c729e800306b83046492214`・`1806b982fffac3a972771ed1dd477154f1176302c323c4e615ecac20611edc07`。resultのSHA256は `385a0354f3775af1d06d7defee61d7c557dd3d3851747f9c8758694342c734c7`・`e1b60dfd8a3c2cb0b43e48b2429b7b8c0c897947bc4c4c1364d2d92cedb779cc`で、ignored原本との照合に使う。

2026-10-30 23:39 JSTの観測では、PR180は作成済み・マージ前で、上の初回記録は作成時点の履歴として残す。旧設計の再利用は設計待ちの「対象外」であり、新たな技術設計は別に計測する。修正実装時間は連続区間を測っていないため未測定、CI待ちとマージまでの総時間は進行中、レビューは初回10工程と修正1回の途中で、次headの再レビューは未実施である。時刻と根拠は実観測をPR本文で補い、欠測を推定で埋めない。週次定期実行は未設定、全体も未完了である。
