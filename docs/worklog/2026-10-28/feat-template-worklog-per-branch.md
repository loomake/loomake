# 2026-10-28 の作業記録（feat/template-worklog-per-branch）

## init が配る AGENTS.md の作業記録の決まりを、ブランチごとのファイルに合わせる（Issue #41）（19:30）

- やったこと：change align-template-worklog のタスク 1.1〜3.2。リポジトリの持ち主の 2026-10-28 の決定に従い、`packages/kit/templates/AGENTS.md` の 6 章の作業記録の決まりを、このリポジトリの AGENTS.md 6 章に合わせた。記録は作業したブランチごとのファイル `docs/worklog/<日本時間の日付>/<ブランチ名>.md` に書き、ブランチ名の `/` は `-` に置き換え、ファイルがあれば追記する。作業記録は作業の PR に含め、作業記録だけの PR は作らず、マージ後に足す記録は次の作業のブランチのファイルに書く。「2026-10-27 までの日付ごとのファイルは移さずに残す」という文は、このリポジトリの移行のための文なので入れていない（A-01）。差分仕様には、agents-rules に ADDED の Requirement「AGENTS.md の作業記録の決まり」（REQ-273）と Scenario を 2 つ書いた。`tests/kit-assets.test.ts` に [REQ-273] の試験を 2 件足し、テンプレートを直す前に 2 件とも失敗することを確かめてから直した。`@loomake/kit` と `loomake` の patch の changeset を足した。`docs/quality/scenarios.json` に Scenario のレビューを 2 件足し、`tests/kit-assets.test.ts` を根拠にする既存の 23 件のハッシュを更新した。この 23 件のハッシュは、rename-acceptance-to-release（2026-10-25）の時点から古いままだった。
- verify の結果：`pnpm -s verify --change align-template-worklog --spec-only` と `--done` は合格（exit 0）。「仮定の承認」の警告は残る（A-01〜A-03 が未承認）。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（1085 件成功、8 件 skip。skip は main と同じ）も通った。`node scripts/scenario-audit.mjs` では、この change の 2 件と、kit-assets を根拠にする既存の 21 件が reviewed になった。REQ-028・REQ-029・REQ-033 の 3 件は Scenario の文が変わっているため無効のまま残した。リポジトリ全体の監査は、ほかのテストのハッシュが古いため、main と同じく不合格のまま。
- 残っている確認事項・仮定：Q-01（REQ-273 の番号が並行する change と重なったときの振り分け。ブロッキングではない）。A-01（移行の文を入れない）・A-02（例のブランチ名を `feat/login` にする）・A-03（日付は日本時間のまま）は未承認。
- 次にやること：PR の CI を見届け、確認事項と仮定の回答を trace.md に書く。

## 確認事項・仮定の回答を trace.md に書く（19:40）

- やったこと：リポジトリの持ち主が、2026-10-28 に本体のセッションの質問で回答した（依頼者経由で伝えられた）。Q-01 は A（並行する change が同じ REQ 番号を取ったら、先にマージした方が番号を残す）とされた。A-01（移行の文をテンプレートに入れない）、A-02（例は `feat/login` → `feat-login.md`）、A-03（配るテンプレートでも日付は日本時間にする）は、いずれも承認された。これらの回答を trace.md に書いた。PR #110 には、Codex のレビューの指摘はまだない（レビューは実行中）。
- verify の結果：`pnpm -s verify --change align-template-worklog --done` は、警告なしで合格した（「仮定の承認」の警告が消えた）。1 回目は、`packages/cli/test/cli.test.ts` の [REQ-050] の性能の試験が 3,506ms かかり、3 秒の上限を超えて失敗した。今回変えたのは trace.md だけで、2 回目は合格した。
- 残っている確認事項・仮定：なし。
- 次にやること：PR #110 の CI と Codex のレビューを見届ける。
