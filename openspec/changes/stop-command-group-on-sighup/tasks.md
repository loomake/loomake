# Tasks

## 1. 監視役

- [ ] 1.1 `[REQ-333]` の 3 件の試験（process.test.ts・新しい supervisor.test.ts・verify.test.ts。project.ts に `interruptScript(signal)` を足す）を書き、HEAD で失敗することを確かめて PR に出力を残す。supervisor.cjs に POSIX だけの SIGHUP のハンドラを足し、3 件と既存の process・orphans・verify の試験が通ることを確かめてコミットする
- [ ] 1.2 `[REQ-334]` の試験（supervisor.test.ts。標準出力の読み手を閉じて監視役を例外で終わらせる）を書き、1.1 のあとの状態で失敗することを確かめる。supervisor.cjs に `!exited` を条件とする exit 時の SIGKILL を足し、試験が通ることを確かめてコミットする
- [ ] 1.3 HEAD のビルド（`pnpm -r build`）で、この worktree の dist を読むようにした `.loomake/repro/sighup-driver4.sh` を、修正の前と後で動かす。結果を PR に書く（Q-01）

## 2. 文書と記録

- [ ] 2.1 `docs/guide/2.guides/3.run-recovery.md` の「端末を閉じたときとコンテナを止めたとき」を design.md の D-4 のとおり直し、yomiyasu で推敲する。文書のリンクの試験が通ることを確かめてコミットする
- [ ] 2.2 `@loomake/kit` の patch の changeset、`docs/quality/scenarios.json` の Scenario のレビュー（変えた試験のファイルを根拠にする既存のレビューのハッシュを更新）、作業記録を足す。`pnpm -s verify --change stop-command-group-on-sighup --done` が exit 0 になることを確かめてコミットする <!-- loomake:gate=done -->
