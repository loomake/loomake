# 2026-10-28 の作業記録（feat/template-worklog-per-branch）

## init が配る AGENTS.md の作業記録の決まりを、ブランチごとのファイルに合わせる（Issue #41）（19:30）

- やったこと：change align-template-worklog のタスク 1.1〜3.2。リポジトリの持ち主の 2026-10-28 の決定に従い、`packages/kit/templates/AGENTS.md` の 6 章の作業記録の決まりを、このリポジトリの AGENTS.md 6 章に合わせた。記録は作業したブランチごとのファイル `docs/worklog/<日本時間の日付>/<ブランチ名>.md` に書き、ブランチ名の `/` は `-` に置き換え、ファイルがあれば追記する。作業記録は作業の PR に含め、作業記録だけの PR は作らず、マージ後に足す記録は次の作業のブランチのファイルに書く。「2026-10-27 までの日付ごとのファイルは移さずに残す」という文は、このリポジトリの移行のための文なので入れていない（A-01）。差分仕様には、agents-rules に ADDED の Requirement「AGENTS.md の作業記録の決まり」（REQ-273）と Scenario を 2 つ書いた。`tests/kit-assets.test.ts` に [REQ-273] の試験を 2 件足し、テンプレートを直す前に 2 件とも失敗することを確かめてから直した。`@loomake/kit` と `loomake` の patch の changeset を足した。`docs/quality/scenarios.json` に Scenario のレビューを 2 件足し、`tests/kit-assets.test.ts` を根拠にする既存の 23 件のハッシュを更新した。この 23 件のハッシュは、rename-acceptance-to-release（2026-10-25）の時点から古いままだった。
- verify の結果：`pnpm -s verify --change align-template-worklog --spec-only` と `--done` は合格（exit 0）。「仮定の承認」の警告は残る（A-01〜A-03 が未承認）。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（1085 件成功、8 件 skip。skip は main と同じ）も通った。`node scripts/scenario-audit.mjs` では、この change の 2 件と、kit-assets を根拠にする既存の 21 件が reviewed になった。REQ-028・REQ-029・REQ-033 の 3 件は Scenario の文が変わっているため無効のまま残した。リポジトリ全体の監査は、ほかのテストのハッシュが古いため、main と同じく不合格のまま。
- 残っている確認事項・仮定：Q-01（REQ-273 の番号が並行する change と重なったときの振り分け。ブロッキングではない）。A-01（移行の文を入れない）・A-02（例のブランチ名を `feat/login` にする）・A-03（日付は日本時間のまま）は未承認。
- 次にやること：PR の CI を見届け、確認事項と仮定の回答を trace.md に書く。
