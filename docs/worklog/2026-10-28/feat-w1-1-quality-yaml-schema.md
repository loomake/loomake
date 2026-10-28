# 2026-10-28 の作業記録（feat/w1-1-quality-yaml-schema）

## W1-1 の 2 つ目：quality.yaml のスキーマ（20:30〜）

- やったこと：change core-quality-yaml-schema のタスク 1.1 の途中。proposal・差分仕様（REQ-283〜REQ-287）・trace・tasks を書いた。PR #113 はマージ済み（80991e8）。
- verify の結果：`--spec-only` は不合格。quality.yaml の値の一覧・`target` の書式・必須のキー・期間の書式が要件定義で決まっておらず、Q-01〜Q-04 をブロッキングにした。実装は始めていない。
- 残っている確認事項・仮定：Q-01〜Q-04（依頼者経由で持ち主に提示する）。A-01（対応する版は 2 だけ）、A-02（YAML の読み込みは kit）は承認待ち。
- 次にやること：回答を trace.md に書き、仕様ゲートを通してから実装する。
- 追記（2026-10-29）：持ち主が本体のセッションでの 1 日 1 回の提示（2026-10-29 06:10 JST 頃）に「おすすめで」と答え、Q-01〜Q-04 と A-01・A-02 をおすすめのとおり trace.md に記録した。W1-1 の残りの決定は [Issue #60 のコメント](https://github.com/loomake/loomake/issues/60#issuecomment-6480846573) に書いた。`--spec-only` は合格。
