# Trace: align-windows-deadline-clock

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 本会話での「待ち時間の差分だけ除外」の明示承認 | - | 2026-10-29 |
| [PR #124の実測](https://github.com/loomake/loomake/actions/runs/40794407791) | 6fccbd2 | 2026-10-29 |
| stop-children-when-supervisor-diesのREQ-257、process.ts、external-budget.test.tsの別試験 | 6fccbd2 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-297 | 本会話の具体差分への承認とREQ-257 | 非機能 | 同runの保持役の準備待ちだけを除き、既存の期限と検証を維持する | 反映済 | specs/ci-deadline-clock-alignment/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-01 | REQ-297 | /tmp/loomake-windows-deadline-clock-fix.patchの計時変更を適用してよいか | 待ち差分だけ除外／診断だけ記録 | 仕様と同じ基準に揃える | no | 承認する（待ち時間の差分だけ除外）。2026-10-29本会話。予算40秒・猶予3秒・既存assertionを維持する範囲 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|

## 範囲と担当

align-windows-deadline-clockの1担当として進める。PR #124の診断実装とは分ける。全worktreeの要件IDを照合してREQ-297が未使用であることを確認した。承認は既存の具体差分の範囲であり、閾値緩和やその他の試験変更は含めない。
