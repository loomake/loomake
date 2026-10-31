# Trace: runner-git-reads-batch

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| `.loomake/handoff/design-b1-runner-tests-2026-10-31.md`（Claude の設計メモ。4.3 節 G1、4.4 節、5.2 節の PR 5、6 節の未確認と Q-B1-4） | origin/main 2ea58979 基準 | 2026-10-31 |
| Issue #116・#178（Windows の時間切れ）・#199（macOS の操作期限の失敗） | - | 2026-10-31 |
| 手元の計測（診断の記録と `GIT_TRACE` による呼び出し元の数え上げ。design.md「背景と計測」） | origin/main b98c2e40 | 2026-10-31 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-348 | 設計メモ 4.3 節 G1（「段階の境目ごとに 1 回の呼び出しにまとめる」「結果は段階の中だけで使い、段階をまたいで使い回さない」）と 4.3 節末尾の「ガードの読み直しの時点を変えないことを、design で境目の一覧として固定する」 | 非機能 | 1 回の run で約 12 回呼ぶ `git rev-parse` を、段階の境目ごとに 1 回の呼び出しにまとめる。結果は段階の中だけで使い、段階をまたいで使い回さない。すべての操作は今までどおり監視役を通し、期限に入れる | 反映済 | specs/run-guards/spec.md |
| REQ-126 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | エンジンを呼ぶ直前に HEAD の SHA とブランチ名を覚え、終わったあとに比べる。G1 は読む時点を変えず、回数だけを減らす | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-198 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | エンジンを呼ぶ前後で、`--git-path config` の中身と `--git-path hooks` のファイルを比べる。G1 は場所の読み取りを HEAD の読み取りと 1 回にまとめる | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-204 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | git が実際に使う設定（`config --list --show-origin`）をエンジンの前後で比べる。G1 はこの読み取りを減らさない | 既存仕様で充足 | openspec/specs/run-guards/spec.md |
| REQ-205 | 呼び出し元の一覧（design.md の #10・#11） | 既存 | 完了ゲートのあいだに作業状態（HEAD・ブランチ）が変わったら最初に止まる。G1 はゲートの前後の読み取りを 1 回ずつにする | 既存仕様で充足 | openspec/specs/run-decision-policy/spec.md |
| REQ-180 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | git の操作は 1 操作の期限と出力の上限で監視し、監視役の起動時間も期限に含める。まとめた呼び出しも同じく監視する | 既存仕様で充足 | openspec/specs/external-process-budget/spec.md |
| REQ-181 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | 期限・出力超過・中断で子孫を止める。G1 は変えない | 既存仕様で充足 | openspec/specs/external-process-budget/spec.md |
| REQ-182 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | run の全体予算を準備・Git などで共有する。まとめた呼び出しも共有予算に入れる | 既存仕様で充足 | openspec/specs/external-process-budget/spec.md |
| REQ-183 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | verify と trace の Git も共通の期限を使い、コマンドの引数などの判定を維持する。この change は trace を変えない | 既存仕様で充足 | openspec/specs/external-process-budget/spec.md |
| REQ-158 | 設計メモ 4.3 節 G1 の「関係する REQ」 | 既存 | 同じ作業ツリーの run を同時に実行しない。ロックの git は準備の読み取りとまとめない | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-137 | 呼び出し元の一覧（design.md の #2・#3） | 既存 | 始める前の git の失敗は使い方の誤りにする。準備の読み取りは変えない | 既存仕様で充足 | openspec/specs/run/spec.md |
| REQ-128 | 設計メモ 4.3 節 G1 の「変える場所」の trace の record | 既存 | trace record は verify の前と後で HEAD を比べる。この change では trace record を変えない（Q-01） | 既存仕様で充足 | openspec/specs/trace-record/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-128・REQ-183 | 設計メモは trace の record も変える場所に挙げている。record の verify の前の `rev-parse HEAD` と `show -s --format=%cI HEAD` を 1 回（`show -s --format=%H%n%cI HEAD`）にまとめるか | A: まとめない（この change は runner だけ）/ B: まとめる | A。減るのは証拠の記録 1 回につき 1 回だけ（5 ファイルで約 58 回、約 1%）。trace のパッケージにも手を入れることになり、REQ-183 の「コマンドの引数を維持する」をどう読むかの判断も要る。効果に見合わない | no | | | |
| Q-02 | REQ-204 | 設計メモの見込み（操作 −25% 前後、CI ubuntu で −60〜−90 秒）は、`config --list` も減らせる前提だった。REQ-204 のためこれは減らせず、見込みは操作 −17%、CI ubuntu で −29〜−44 秒になる。この効果で実装に進めてよいか | A: 進める / B: 見送り、試験の側の改善（T1〜T4・P1）を先にする | A。Windows の run.test.ts だけで約 −73 秒の見込みで、時間切れの元になる操作数を、試験の期待値を変えずに減らせる唯一の手である | no | | | |
| Q-03 | REQ-348 | 仕様ゲートは差分仕様のない change を通さない。回数の約束をどこに書くか | A: run-guards に新しい Requirement（REQ-348）として足す / B: 既存の REQ-126・REQ-198 を MODIFIED にして回数を書き足す | A。既存の Requirement の文と試験を変えずに済み、archive の差分も小さい。回数を試験で確かめるので、後の変更で元に戻ったときに気づける | no | | | |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-348 | 境目ごとの読み取りの回数と「使い回さない」ことを、run-guards の Requirement（REQ-348）として足す。`config --list` は減らさない | 仕様ゲートは差分仕様のない change を通さない（`差分仕様` の検査）。また回数を減らすことがこの change の目的で、試験で確かめられる約束にしておかないと、後の変更で元に戻っても気づけない。既存の REQ-126・REQ-198・REQ-204・REQ-205 の値・時点・止まる条件は変えない | | | |
| A-02 | REQ-126 | HEAD のコミットがない（unborn）場合や、まとめた呼び出しの出力の行の数が合わない場合は、今と同じ別々の呼び出しに戻す。期限や出力の上限による例外は戻さずにそのまま渡す | 手元の git 2.56.0 で、unborn のとき `rev-parse ... HEAD` は終了コード 128 で失敗し、今の `headState` は `sha` を空、`branch` を `HEAD` にしている。同じ値を返すには戻すのが確実 | | | |
| A-03 | REQ-158・REQ-137 | ロックの `--absolute-git-dir` と、準備の `--abbrev-ref HEAD`・`--verify --quiet refs/heads/<branch>` はまとめない | ロックを取る前に HEAD を読むと、先の run が HEAD を変えた場合に古い値を使う。`--verify` は引数を 1 つしか受け付けず、まとめるとブランチがない場合と unborn を見分けられない。減るのは run 1 回につき 1〜2 回 | | | |
| A-04 | REQ-180 | 見込みの秒数は、手元の 1 操作 15ms、CI の膨らみ 2.2〜3.4 倍、Windows の 1 操作 約 238ms、macOS の約 138ms（設計メモ 1.1 節・1.2 節）からの推測で、Windows・macOS では確かめていない | dev container は Linux。前後の数はタスク 3.1 で数え、時間は PR の CI（`ci:all-os`）で比べる | | | |
