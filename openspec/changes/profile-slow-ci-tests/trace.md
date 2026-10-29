# Trace: profile-slow-ci-tests

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 本会話の「準備・本処理・待機の時間を分けて計測」の提案への「続けて」 | - | 2026-10-29 |
| [PR #118 のCI](https://github.com/loomake/loomake/actions/runs/40778419168) のWindows 1/2診断 | - | 2026-10-29 |
| tests/ai-journeys.test.ts・scripts/ai-journeys.mjs・tests/package-build.setup.ts・packages/runner/test/external-budget.test.ts | ab04764 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-292 | 本会話の内訳計測の提案と着手指示 | 非機能 | 明示的に有効にした対象試験の区間を、検証を変えずに記録する | 反映済 | specs/ci-phase-profiling/spec.md |
| REQ-293 | 本会話の準備・本処理・待機の区別と、既存の時間記録 | 非機能 | 区間の重複を避け、共有準備と欠損を区別して表示する | 反映済 | specs/ci-phase-profiling/spec.md |
| REQ-294 | 本会話の複数回の測定による傾向確認 | 非機能 | Windowsの3サンプルを独立して測り、結果と実行条件を保存する | 反映済 | specs/ci-phase-profiling/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|

## 範囲と担当

全17 worktreeを照合して、REQ-292〜294が未使用であることを確認した。今回の担当はprofile-slow-ci-testsの1担当とし、PR #118は完成済みの土台、PR #119は判定API移管の別作業として扱う。新しい実行は計測用であり、元の品質CIの時間と同一とは扱わない。

共有期限40秒は、その前の通常処理と停止待ちを合わせた予算であり、40秒すべてを意図的な待機とは見なさない。3サンプルは初期の観測数として採用し、統計的な性能保証や短縮の達成とは報告しない。

## 承認記録

2026-10-29、本会話で利用者が `/tmp/loomake-profile-windows-command.patch` の適用を明示承認した。承認の範囲は、独立したWindows計測workflowの起動を `pnpm test` から `node node_modules/vitest/vitest.mjs run` へ変えることと、対応するREQ-294契約試験のコマンド期待値の更新である。Windowsのcmd経由で正規表現が解釈される問題を避け、Vitestの同じエントリをNodeで直接起動する。対象4ケース、正規表現、Vitest設定、元の検証の期待値、共有期限と予算は変更しない。
