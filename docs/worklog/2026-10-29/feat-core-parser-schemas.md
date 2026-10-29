# feat/core-parser-schemas

- やったこと：change core-parser-schemas の仕様一式を作成した。Issue #60 の Q-03 決定を出典に REQ-298〜REQ-300 を定め、品質スキーマの head 0b7b80f から専用 worktree を作成した。実装はまだ行っていない。
- verify：仕様ゲートと `openspec validate core-parser-schemas --strict` は exit 0。依存は既存のインストールを参照し、pnpm の実行時だけ `--config.verifyDepsBeforeRun=false` で自動再インストールを抑止した。検証設定・lockfile は変更していない。
- 確認事項・仮定：追加の未決事項なし。Markdown、同期 API、返却データ、意味検証と性能閾値を維持する。
- 次：tasks 1.1 から順に実装し、独立レビューと同じ head の CI を確認する。Issue #60 全体は後続の移行が残るため close しない。

前作業の引き継ぎ：CI 修理の PR #120・#124・#126 は対象 head の完了ゲートと必須 CI の成功を確認して main へ取り込まれた。[archive PR #127](https://github.com/loomake/loomake/pull/127)も、全必須 CI・通常の verify（mode=quality）・28 specs の strict 検証に成功して main e2ad57a へマージされた。[CI](https://github.com/loomake/loomake/actions/runs/40800385845)。Issue #116 は残存原因を追うため open のままとし、元の作業フォルダの未追跡 3 ファイルは保持した。品質スキーマの PR #128 もその後 main e408d76 へ取り込まれており、この作業の PR は main を base にする。

- やったこと：task 1.1。3 形式と各行の Zod スキーマを追加し、既存の 7 公開型をスキーマから導出した。意味検証とパーサの処理は維持した。
- verify：新規の要件 ID 付き試験と既存パーサの試験は 25/25 成功、型チェックは exit 0。
- 確認事項・仮定：なし。
- 次：task 2.1 の公開定数・遅延ロード・利用案内。

- やったこと：task 2.1。公開スキーマバージョン定数と遅延ロード関数、core の利用案内を追加した。
- verify：要件 ID 付き試験と Zod の静的 import 検査は 8/8 成功、型チェックは exit 0。README は yomiyasu の検査と最終稿の照合を実行した。
- 確認事項・仮定：なし。
- 次：task 3.1 の JSON Schema 生成と配布経路。

- やったこと：task 3.1。3 形式の JSON Schema を生成・公開し、既存の配布物 smoke と公開型の利用側 fixture、patch の changeset を追加した。
- verify：生成差分・AJV による独立検証・parser・静的 import の試験は 14/14 成功。lint と型チェックも exit 0。core を pack して別の利用先へ展開し、公開 exports から定数・loader・JSON を読み取れることを確認した。
- 確認事項・仮定：なし。JSON に独自のバージョン annotation は加えていない。
- 次：task 4.1 の全体試験と完了ゲート。ローカル環境の空き容量と POSIX 権限の制約があるため、必要なら同じ head の PR CI で受入を確認する。

- やったこと：task 4.1 の完了ゲートを実行した。独立レビュー 1 回目（実装 head 49f84d2）は重大な指摘なし。
- verify：ローカルの完了ゲートは exit 1。lint・型チェック・タスク・全 Requirement のテスト対応は成功したが、全体試験は 1,235 件中 1,202 成功・25 失敗・8 skip。失敗時に自己タスクの完了印を戻した。
- 確認事項・仮定：worktree 内 TMPDIR では長い Unix ソケットパスの EINVAL、type:module を継承した偽コマンドの require 未定義、chmod の差異が出た。既存のテストや製品設定は変更せず、ネイティブ Linux の CI で同じ head を検証する。
- 次：draft PR の品質 CI を確認し、全体成功後に task 4.1 を完了にして最終 head の同じ完了ゲートを確認する。変更全体の完了はまだ宣言しない。

- やったこと：task 4.1 の自己タスクを、ネイティブ CI の結果を根拠に確定した。[PR #131](https://github.com/loomake/loomake/pull/131)の実装は独立レビュー済みの 49f84d2 と同一である。
- verify：[初回 CI](https://github.com/loomake/loomake/actions/runs/40802266085)で lint・型チェック・全体試験 1,227 成功/8 skip・coverage・配布物 smoke・Node 20/22・CodeQL が成功した。[gate のログ](https://github.com/loomake/loomake/actions/runs/40802266085/job/123212882402)は最後の未チェック自己タスクだけが不合格で、すべてのコマンドと要件ごとのテストは成功した。
- 確認事項・仮定：追加なし。ローカル環境差による失敗を製品や試験の変更で回避していない。
- 次：タスク確定後の同じ head の完了ゲートを確認し、受入は管理役へ引き継ぐ。Issue #60 全体は後続の作業が残るため open を保つ。
