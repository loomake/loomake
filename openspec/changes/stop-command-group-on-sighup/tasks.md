# Tasks

Q-04 は ADR 0006 の包括承認に基づきおすすめ A を採用済み。仕様ゲートを通してから実装する。

## 1. 監視役

- [ ] 1.1 `[REQ-333]` の 4 件の試験（process.test.ts・新しい supervisor.test.ts・verify.test.ts・配布物の E2E。project.ts に `interruptScript(signal)` を足す）を書き、HEAD で失敗することを確かめて PR に出力を残す。supervisor.cjs に POSIX だけの SIGHUP のハンドラを足し、4 件と既存の process・orphans・process-startup・verify の試験が通ることを確かめてコミットする
- [ ] 1.2 Q-04 の包括承認による A 回答を記録し、回答に従い specs・design・trace を整合させて仕様ゲートを通す。その後 `[REQ-334]` の EPIPE 試験を書き、1.1 のあとの Red を PR に残す。SIGTERM 猶予中の先頭終了後に例外終了する Scenario と回帰試験も加え、!exited で Red、!killed で Green と確かめる。回答に沿う exit ハンドラを足し、SIGKILL 送信済みの正常終了・SIGINT で再送しないことも確認してコミットする
- [ ] 1.3 HEAD のビルド（`pnpm -r build`）で、この worktree の dist を読むようにした `.loomake/repro/sighup-driver4.sh` を、修正の前と後で動かす。結果を PR に書く（Q-01）

## 2. 文書と記録

- [ ] 2.1 `docs/guide/2.guides/3.run-recovery.md` の「端末を閉じたときとコンテナを止めたとき」を design.md の D-4 のとおり直し、yomiyasu で推敲する。文書のリンクの試験が通ることを確かめてコミットする
- [ ] 2.2 `@loomake/kit` の patch の changeset、`docs/quality/scenarios.json` の Scenario のレビュー（変えた試験のファイルを根拠にする既存のレビューを確かめ直してから更新）、作業記録を足す。`pnpm -s verify --change stop-command-group-on-sighup --done` が exit 0 になることを確かめてコミットする <!-- loomake:gate=done -->
