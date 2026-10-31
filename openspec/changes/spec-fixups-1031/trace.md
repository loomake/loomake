# Trace: spec-fixups-1031

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 管理役の依頼（仕様の不備 2 件の修正。不備 2：tier-ci-gate の Scenario の文言と実装の食い違い） | - | 2026-10-31 |
| PR #194 のレビュー（SCN-149eab9b の THEN の「だけ」は verify の呼び出しについてと読んだ、という指摘） | - | 2026-10-31 |
| openspec/specs/monorepo/spec.md（REQ-132・REQ-343） | main e0195dc | 2026-10-31 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-132 | PR #194 のレビュー、管理役の依頼 | 既存変更 | Scenario「明示を優先する」の THEN を、実行するコマンド全体ではなく verify の呼び出しを限定する文言に直す。段階 L1 で lint と文書のリンクの試験も実行するのは REQ-343 の本文どおりで、Scenario「変えたファイルとブランチ名を合わせる」は、L1 で完了した印のない c1 を `--spec-only` で検査する REQ-343 どおりに WHEN・THEN を直す。Requirement の本文は変えない | 反映済 | specs/monorepo/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

## 経緯

- PR #194（Scenario 台帳の再確認）のレビューで、tier-ci-gate の archive（PR #195）後の主仕様の Scenario「明示を優先する」（SCN-149eab9b）の THEN が「`verify --change c1 --done` だけが実行される」となっているのに、実装と試験は段階 L1 で lint と文書のリンクの試験も呼ぶことが分かった。試験と実装が REQ-343 の本文どおりで、Scenario の文言が誤っている
- 依頼では SCN-d31a4872・SCN-711b5333・SCN-2f7149cc も同じ食い違いとされていたが、3 件の THEN は tier-ci-gate の archive ですでに「段階は L1 になり、lint と文書のリンクの試験だけが実行される」になっており、試験の期待（lint と文書のリンクの試験だけを呼び、verify を呼ばない）と一致する。この 3 件は仕様を変えず、レビュー表だけを記録し直す
- 管理役の追加の依頼で、同じ Requirement の Scenario「変えたファイルとブランチ名を合わせる」を確かめた。入力は `openspec/changes/c1/tasks.md` だけの変更なので段階は L1 になる。REQ-343 は L1 で完了した印のない change を `--spec-only` で検査すると定め、`scripts/ci-gate.mjs` の `gateArgs` と試験（c1 は印のない内容に書き換わり `--spec-only`、c2 は印が残り `--done`）もそのとおりだった。誤っているのは Scenario の文言なので、tasks.md の状態を WHEN に書き、THEN を直した
- Opus レビュー（5b11fcb）の指摘で、Scenario「明示を優先する」の WHEN に c1 の tasks.md の状態を足し、`tests/ci-gate-process.test.ts` の 1 件の試験名と `scripts/ci-gate.mjs` の冒頭のコメントを `gateArgs` の動きに合わせた（試験の本文と期待値は変えていない）
