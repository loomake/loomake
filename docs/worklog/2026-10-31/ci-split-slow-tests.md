# 速度対策1-1の共有build

1. `split-slow-ci-checks` task2.2を実装・検証した。rootからpackage/slowへ配布物を共有し、inject欠落を拒否する。引継ぎと未完了範囲は [Issue121](https://github.com/loomake/loomake/issues/121#issuecomment-6533973395) に記録した。
2. spec-only、型、lint、共有準備5試験、実配布物12試験が成功。実pack失敗時のcleanup、fixtureの実tsc失敗と元例外保持、実watch再build・inject更新・正常closeを確認した。
3. case分割・全体done・coverage・3OS実測・ruleset操作は未完了。独立依存の本体差分は0、生成キャッシュ6件の差分は保存した。初回のVite例外表示とwatch終了操作の失敗も保持する。
4. 次はtask2.3の空registryとnamed slowの準備を進める。PR179統合と残10file設計の前提は維持する。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 1-1、PR未作成 | 未測定（既存Opus設計を再利用） | 進行中 | 未実施 | 未実施 | 進行中 |

観測日は2026-10-31 JST。対象はtask2.2の作業ツリーで、確定headの完了ゲート・CI・最終レビューの成功ではない。検証原本は専用treeの `.loomake/ci-implementation/c3-final/c3-receipt.json` に保存した。

1. task2.3として、空の測定一覧と純粋なfast/slow選択を実装した。未測定のOS割当とcase本体は追加していない。
2. 選択14件と共有準備5件、型・lintが成功。実設定を同じbyteで使う独立fixtureの7経路で、PRと両shardのslow不実施、local/push/schedule/releaseの全件、空ファイル除外とPR両shardの和集合を確認した。元のreporter/outputFile/coverageと製品gateは保持した。
3. fixtureの成功は実caseの3OS性能合格ではない。タスクは5/18完了で、case分割・全体done・CI・最終レビュー・人ruleset操作は未完了。
4. 次はtask2.4の実13条件の独立mutation試験を追加する。計測表は上記の進行中の状態を維持する。

1. task2.4の選択APIと13条件の個別mutation試験を実装した。CLIの既定13条件と元の全体試験は残した。
2. 元と新規の33試験、型・lintが成功。各条件で実baseline10件・同じ既存テストのassertion失敗・元source/test/reportの保持・保存JSONと返値の一致を確認した。未知・重複・空の選択は保存前に拒否する。
3. 3OS各3sampleによるfast確定は未実施のため、task2.4は未チェック、5/18完了のままとする。初回のTypeScript推論エラーも検証ログに保持した。
4. 次は固定headの通常verifyを実行し、PR179の最終受入・統合と残10file設計の前提を確認する。計測表の実装とマージまでの値は進行中、CIと最終レビューは未実施である。

通常verifyのhead06e9066は、1548成功・1失敗・既存skip8だった。全体実行ではrootのinjectがあるため、テストで渡したundefinedが既定値のinjectへ置き換わる問題を検出した。元の5期待値を保ち、利用側でinjectした値を検査関数へ明示して渡す形へ修正した。元の失敗reportとログを保持し、新headで再検証する。配布パッケージに変更がないため空changesetを追加した。

修正headb39aea6の通常verifyは容量不足で失敗したが、生成済みダウンロードキャッシュ2件をhash照合して退避した後、同head・設定/期待値/TMPDIR不変で1549成功・失敗0・既存skip8となった。失敗124件の原本も保持した。差分は [Draft PR184](https://github.com/loomake/loomake/pull/184) へまとめ、受入は未完了としている。

1. 独立Opus設計92ea61a2と既存archiveの前例を管理役が確認し、5.3〜5.5を原文・番号・順序・担当を保った「完了ゲート後の必須受入」へ移した。全18件の意図を実装15タスクと必須受入3件で保持する。
2. 計画の整合であり、verify・CI・テスト・設定・規則は変更していない。元の実装15行と必須受入3行をbyteで照合し、strict/spec-onlyを再確認する。
3. 実装は5/15、必須受入3件はいずれも未実施。タスク数の変更を完成範囲の縮小や完了とは扱わない。最終Opusは全重大度ゼロ、同headの必須CIと自動Codex、人のnode20-only操作、マージとsync/archiveまで必要である。
4. PR179の受入後統合と残10file設計・3OS実測へ進む。計測表は実装・マージまで進行中、最終レビュー未実施を維持する。
