# 2026-10-29 docs/agent-workflow-principles

1. 開発手順の変更：[PR #146](https://github.com/loomake/loomake/pull/146)。工程別のモデル分担と4つの共通原則を追加し、AGENTS.mdから参照。利用者向けの自動切り替えは後続changeとして区別した。
2. 検証：change単位のverifyは対象外。差分の空白検査と相対リンク11件の確認は成功。別セッションの独立レビューで重大指摘なし。文書とPR本文のyomiyasu run/verifyは4件とも終了0。既存CIの結果はPRで確認する。
3. 人の判断待ちの確認事項・仮定：なし。指定モデルの起動や方式間の比較は未検証であり、モデル間レビューを実行したとは扱わない。
4. 次：CIとPRレビューを確認する。製品への展開は別changeの仕様ゲートから進める。
