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
