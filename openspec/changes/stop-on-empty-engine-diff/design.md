# Design: stop-on-empty-engine-diff

## 判断の位置

エンジンの終わり方の判断（`decideAfterEngine`、REQ-204）は変えず、そのあとに変更の有無の判断（`decideAfterChanges`、REQ-332）を置く。

順序：エンジン → `decideAfterEngine`（中断・上限・質問・終了コード・HEAD／Git内部の変更）→ `guard()`（不正な直し方）→ `decideAfterChanges` → タスクを完了にしてコミット。

質問が合図より先になり、不正な直し方はタスクを完了にする前に止まる。

## 差分の判定

`guard()` の中の `findViolations` が `git add -A` で index に載せた状態を、`checkTask` の前に `git diff --cached --name-only` で調べる。

- ガードの入力と同じ差分なので、判定の範囲がずれない。
- run 自身が付ける tasks.md のチェックは、まだ index にないので、「チェックだけの差分」を除く処理が要らない。
- エンジンが tasks.md を変えた場合は、ガード（REQ-111）が先に止める。
- 直しの段階は、既存の `phases.ts` の判定と同じ書き方にそろえる。

## 合図

`LOOMAKE-QUESTION:` と同じく、行頭の合図にする（`/^LOOMAKE-NOCHANGE:[ \t]*(\S.*)$/m`）。

- 理由を必須にするのは、変更なしの完了をレビューで見分けるため。
- 合図はタスクの段階だけで意味を持つ。直しの段階では、差分のない直しは完了ゲートの結果を変えないので、合図があっても止まる。

## 止まり方

状態は既存の `stopped`、終了コードは 1（REQ-107）とし、`RunSummary` の型は変えない。

- 止まるとき index は空なので、`git reset` は要らない。
- 作業ツリーにある `.gitignore` 除外のファイルには触れない。

## 選ばなかった案

- 合図を認めず、常に止まる：変更不要なタスクのたびに人の操作が要る（確認事項 Q-01）。
- tasks.md のチェック後に、tasks.md を除いて比べる：除外の処理が増え、エンジンの tasks.md の変更と区別しにくい。

## 設計工程の記録

- 実行ツール：Claude Code 2.1.308（`.agents/skills/delivery/scripts/ask-opus.mjs` 経由）
- セッション：`c9f6a4c0-7acf-4533-a132-1b6d6fec06dc`
- events.jsonl で観測した主モデル：`claude-opus-5-5`（assistant イベント 66 件）
- modelUsage には `claude-haiku-5-5`（出力 24 トークン、補助的な呼び出し）も含まれていたため、スクリプトは `ok:false`（未実施）を返した
- この設計の工程状態：未実施（人の判断待ち）。Opus の設計工程を実施済みとは扱わない
