# Trace: fix-quality-reference-source-links

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| openspec/specs/reference-docs/spec.md | main f4e3edb7145f35dac49fd139902ab17c5592a5d5、REQ-322 | 2026-10-29確認 |
| scripts/quality-reference.mjs、生成済みqualityページ、tests/quality-reference.test.ts | main f4e3edb、生成元2相対hrefと既存assertion | 2026-10-29確認 |
| 使い方の文書の置き場所 | [Issue #102](https://github.com/loomake/loomake/issues/102)、切れない文書導線 | 2026-10-29確認 |
| loomake.devへの取り込み | [Issue #103](https://github.com/loomake/loomake/issues/103)、GitHubとサイトでの生成元2リンクの誤解決 | 2026-10-30確認 |
| リファレンスの生成 | [Issue #104](https://github.com/loomake/loomake/issues/104)、生成ページとスキーマの一致 | 2026-10-29確認 |
| AGENTS.md 4章、docs/dev/agent-workflow.md | main f4e3edb、承認・分担・共通原則1 | 2026-10-29確認 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-322 | 現行reference-docs、Issue #102/#103/#104、rendererと生成ページ | 移行 | 生成元・既存文書導線を保ち、GitHubとサイトで同じ生成元2ファイルを参照する。その他の公開契約を変えない | 反映済 | specs/reference-docs/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| T-URL-01 | REQ-322 | proposalのコード例に示した既存1 assertionの相対URL期待をGitHub URL期待へ置き換え、2リンクの追加検査を行ってよいか。AGENTS.md 4章に基づく承認 | A：示した1 assertionの置換と追加検査を承認。B：承認せず現状保持・別案検討。サイトの誤解決と#103の生成元リンク未修理が続く | A。GitHubとサイトから同じ実在ソースを参照し、2 hrefの完全一致・各1回・実在・解決結果を確かめる。既存の1.compatibility.mdもblob/mainの完全URLを使う | yes | A。[承認元](https://github.com/loomake/loomake/pull/149#issuecomment-6509157217)。実装前条件のworklog競合はmain内容の保持で解消 | rrr-www（利用者rrr-xxxの指示をClaude Codeが転記） | 2026-10-30 |

承認範囲はproposalのコード例に示した既存1 assertionの置換と2リンクの追加検査に限る。条件だった `docs/worklog/2026-10-29/feat-cli-reference-generation.md` のadd/add競合はmainの受入済み内容を保持して解消した。仕様ゲート成功前には実装しない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で補わない。既知の2ソースパス、既存コマンドでの再生成、URL解決と通常ファイルの検査は、承認済みの追加検査を具体化したdesignに従う。

## 担当と検証の範囲

担当割当・モデル・セッション・検証の実行履歴は、[設計反映時の作業記録](../../../docs/worklog/2026-10-29/spec-quality-reference-source-links.md#opus新規設計の反映と実行可否の訂正)と[レビュー対応の作業記録](../../../docs/worklog/2026-10-30/spec-quality-reference-source-links.md)を参照する。要件の出典とは区別する。
