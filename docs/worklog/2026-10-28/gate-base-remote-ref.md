# 2026-10-28 の作業記録（gate-base-remote-ref）

## gate の差分のベースをリモートの追跡ブランチにそろえる（Issue #42 の 3）（10:05）

- やったこと：change gate-base-remote-ref のタスク 1.1〜3.2。`scripts/ci-gate.mjs` は、PR で変えたファイルを `origin/${base}...HEAD` の差分で調べていた。同じ名前のタグやブランチ（`refs/tags/origin/main`・`refs/heads/origin/main`）があるとそちらが先に選ばれるので、ベースを `refs/remotes/origin/${base}` に直した。差分仕様には ADDED の Requirement「完了ゲートが読む差分のベース」（REQ-272）と、Scenario「同じ名前のタグやブランチがある」を書いた。`tests/ci-gate-process.test.ts` に、一時的な git リポジトリで同じ名前のタグとブランチが PR のコミットの途中を指していても `verify --change c1 --done` を呼ぶ試験を 2 件足した。直す前のスクリプトで 2 件とも失敗することを確かめてから直した。`docs/quality/scenarios.json` に Scenario のレビューを足し、`tests/ci-gate-process.test.ts` を根拠にする既存の 13 件のハッシュを更新した（既存の試験の中身は変えていない）。`scripts/` と `.github/workflows/` で、`origin/<base>` とだけ書いた差分のベースはほかになかった。ci.yml と release.yml の `git branch main origin/main` はローカルの main を作るための行で、差分のベースではないので、この change の範囲外とした。
- verify の結果：`pnpm -s verify --change gate-base-remote-ref --spec-only` と `--done` は合格（exit 0）。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（1057 件）も通った。`node scripts/scenario-audit.mjs` では、この change の Scenario は reviewed になった。リポジトリ全体の監査は、ほかのテストのハッシュが古いため、main と同じく不合格のまま。
- 残っている確認事項・仮定：Q-01（REQ-272 の番号が並行する change と重なったときの振り分け。ブロッキングではない）。A-01（REQ-132 を MODIFIED にせず、要件を足す）は未承認。
- 次にやること：PR の CI を見届ける。Issue #42 の 1・2・4 は別の作業で扱う。
