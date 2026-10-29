# feat/core-parser-schemas

- やったこと：change core-parser-schemas の仕様一式を作成した。Issue #60 の Q-03 決定を出典に REQ-298〜REQ-300 を定め、品質スキーマの head 0b7b80f から専用 worktree を作成した。実装はまだ行っていない。
- verify：仕様ゲートと `openspec validate core-parser-schemas --strict` は exit 0。依存は既存のインストールを参照し、pnpm の実行時だけ `--config.verifyDepsBeforeRun=false` で自動再インストールを抑止した。検証設定・lockfile は変更していない。
- 確認事項・仮定：追加の未決事項なし。Markdown、同期 API、返却データ、意味検証と性能閾値を維持する。
- 次：tasks 1.1 から順に実装し、独立レビューと同じ head の CI を確認する。Issue #60 全体は後続の移行が残るため close しない。

前作業の引き継ぎ：CI 修理の PR #120・#124・#126 は対象 head の完了ゲートと必須 CI の成功を確認して main へ取り込まれた。[archive PR #127](https://github.com/loomake/loomake/pull/127)も、全必須 CI・通常の verify（mode=quality）・28 specs の strict 検証に成功して main e2ad57a へマージされた。[CI](https://github.com/loomake/loomake/actions/runs/40800385845)。Issue #116 は残存原因を追うため open のままとし、元の作業フォルダの未追跡 3 ファイルは保持した。品質スキーマの PR #128 もその後 main e408d76 へ取り込まれており、この作業の PR は main を base にする。
