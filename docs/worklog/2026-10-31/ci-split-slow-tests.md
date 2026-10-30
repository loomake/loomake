# 速度対策1-1の共有build

1. `split-slow-ci-checks` task2.2を実装・検証した。rootからpackage/slowへ配布物を共有し、inject欠落を拒否する。引継ぎと未完了範囲は [Issue121](https://github.com/loomake/loomake/issues/121#issuecomment-6533973395) に記録した。
2. spec-only、型、lint、共有準備5試験、実配布物12試験が成功。実pack失敗時のcleanup、fixtureの実tsc失敗と元例外保持、実watch再build・inject更新・正常closeを確認した。
3. case分割・全体done・coverage・3OS実測・ruleset操作は未完了。独立依存の本体差分は0、生成キャッシュ6件の差分は保存した。初回のVite例外表示とwatch終了操作の失敗も保持する。
4. 次はtask2.3の空registryとnamed slowの準備を進める。PR179統合と残10file設計の前提は維持する。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| 1-1、PR未作成 | 未測定（既存Opus設計を再利用） | 進行中 | 未実施 | 未実施 | 進行中 |

観測日は2026-10-31 JST。対象はtask2.2の作業ツリーで、確定headの完了ゲート・CI・最終レビューの成功ではない。検証原本は専用treeの `.loomake/ci-implementation/c3-final/c3-receipt.json` に保存した。
