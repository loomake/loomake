# Trace: fix-quality-reference-source-links

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| openspec/specs/reference-docs/spec.md | main f4e3edb7145f35dac49fd139902ab17c5592a5d5、REQ-322 | 2026-10-29確認 |
| scripts/quality-reference.mjs、生成済みqualityページ、tests/quality-reference.test.ts | main f4e3edb、生成元2相対hrefと既存assertion | 2026-10-29確認 |
| 使い方の文書の置き場所 | [Issue #102](https://github.com/loomake/loomake/issues/102)、切れない文書導線 | 2026-10-29確認 |
| リファレンスの生成 | [Issue #104](https://github.com/loomake/loomake/issues/104)、生成ページとスキーマの一致 | 2026-10-29確認 |
| AGENTS.md 4章、docs/dev/agent-workflow.md | main f4e3edb、承認・分担・共通原則1 | 2026-10-29確認 |
| delivery管理役からの計画準備の割当 | Codexによる資料作成と、実行確認後のOpus新規設計の反映。製品・試験の編集や追加評価は行わない | 2026-10-29 |
| Opusの新規設計出力 | 対象64e5c45、claude-opus-5-5、session 4190d7a2-20b1-42f3-8320-c16eded842bd。出典はdesign末尾の実行記録 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-322 | 現行reference-docs、Issue #102/#104、rendererと生成ページ | 移行 | 生成元・既存文書導線を保ち、GitHubとサイトで同じ生成元2ファイルを参照する。その他の公開契約を変えない | 反映済 | specs/reference-docs/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| T-URL-01 | REQ-322 | proposalのコード例に示した既存1 assertionの相対URL期待をGitHub URL期待へ置き換え、2リンクの追加検査を行ってよいか。AGENTS.md 4章に基づく承認 | A：示した1 assertionの置換と追加検査を承認。B：承認せず現状保持・別案検討 | A。GitHubとサイトから同じ実在ソースを参照し、2 hrefの完全一致・各1回・実在・解決結果を確かめる | yes |  |  |  |

回答・回答者・回答日は空のままとし、Aを承認済みにしない。T-URL-01が未回答の間は、renderer・生成ページ・試験の変更と実装開始を止める。仕様案の2 URLや、この計画準備への割当をテスト変更の承認へ読み替えない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で補わない。既知の2ソースパス、既存コマンドでの再生成、URL解決と通常ファイルの検査はdesignの技術案であり、T-URL-01の承認前には実装しない。

## 担当と検証の範囲

branchは `spec/quality-reference-source-links`、worktreeは `.claude/worktrees/codex-quality-reference-source-links`。既存PRとworktreeに同changeの担当がいないことを確認した。renderer・生成ページ・試験・設定・主仕様は変更していない。

当初はOpusの実行可否を確認していないのに、利用できないと記載した。既存認証が有効と確認した後、対象64e5c45に対してClaude Codeの新しいsessionでOpus設計を1回生成した。actual modelUsageはclaude-opus-5-5のみ、sessionは4190d7a2-20b1-42f3-8320-c16eded842bd、exit 0、is_error=false、permission_denials=[]。新規設計の出典と反映範囲はdesignの実行記録に記す。

日本語資料の整合は管理役配下のCodexが担当する。Codexの実際のモデル識別子は不明、共通原則は1。設計生成は評価ではなく、AI評価は0回。独立した設計レビューと最終レビューは未実施。最終レビューは後日の別Opus session、自動bot予定分は1枠を確保し、今回追加の評価を依頼しない。

URL解決とローカルソースの存在を調べた。修正後の回帰試験、site build、公開サイトのHTTP到達、done・全体試験は未実施である。今の成果は承認待ちの計画に限り、設計レビュー・最終レビューを依頼していない。
