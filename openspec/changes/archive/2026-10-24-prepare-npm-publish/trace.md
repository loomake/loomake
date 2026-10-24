# Trace: prepare-npm-publish

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
A の番号はこの change の中の通し番号にする。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/release.md（npm 公開前の確認結果）の「公開前に直すべきこと」1〜4 | - | 2026-10-23 |
| 依頼者の指示（会話で受け取った「おすすめで続けて」。docs/release.md の「進め方の案」1 を進める） | - | 2026-10-23 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-138 | docs/release.md 1・3 | 非機能 | 5 つすべてに `repository.directory` つきで `repository`・`homepage`・`bugs` を書く。`loomake` の description に trace と run を足し、core・kit・trace・runner に description を書く。検索用に `keywords` も入れる | 反映済 | specs/monorepo/spec.md |
| REQ-139 | docs/release.md 2・7 | 非機能 | `loomake` には短い README（何をするか、`npx loomake init`、docs へのリンク、実行時に要る `openspec` と `gh`）を入れる。中の 4 つには、内部用であることと API の扱いを短く書く | 反映済 | specs/monorepo/spec.md |
| REQ-140 | docs/release.md 4 | 非機能 | release ワークフローは公開の前に lint・typecheck・test を実行する。同時実行を止める `concurrency` を足す | 反映済 | specs/monorepo/spec.md |
| REQ-141 | docs/release.md 4 | 非機能 | 継続して公開する分は Trusted Publishing（OIDC）に移し、`permissions: id-token: write` を足す。初回の認証と 2 回目以降の認証は分けて用意する。npm は 11.5.1 以上が条件 | 反映済 | specs/monorepo/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する。回答を書いたら、回答者（名前の代わりに役割でもよい）と回答日（YYYY-MM-DD）も書く -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-138, REQ-139, REQ-141 | GitHub のリポジトリ `loomake/loomake` はいま private。npm に公開する前に public にするか | A: 公開前に public にする / B: private のまま公開する | A。README と `homepage` のリンクは private だと npm の利用者が開けない。provenance も公開リポジトリでないと付かない | no | A：完成したら、npm に公開する前に public にする | 利用者 | 2026-10-24 |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない）。承認したら、承認者（名前の代わりに役割でもよい）と承認日（YYYY-MM-DD）も書く -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-138 | `description` は日本語で書き、`keywords` は `openspec`・`ai-agent`・`requirements-traceability`・`spec-driven-development` などの英語の語とする | 利用者に見せる文は日本語で書く規約に合わせる。keywords は npm の検索で使われる英語の語にする | 承認（依頼者の「おすすめで続けて」の指示による） | 依頼者 | 2026-10-23 |
| A-02 | REQ-139 | README の docs へのリンクは `https://github.com/loomake/loomake` の下の docs を指す | npm のページからは相対リンクが開けない。リポジトリが private のままならリンクは開けない（Q-01） | 承認（依頼者の「おすすめで続けて」の指示による） | 依頼者 | 2026-10-23 |
| A-03 | REQ-140 | 品質コマンドは `pnpm build` のあと、`pnpm changeset publish` の前に実行する。`concurrency` のグループはワークフロー名で 1 つにする | test は build 済みの dist を使うものがあるため。公開は main からしか行わないので、グループは 1 つで足りる | 承認（依頼者の「おすすめで続けて」の指示による） | 依頼者 | 2026-10-23 |
| A-04 | REQ-141 | 初回は手元からではなく、release ワークフローを `NPM_TOKEN` で動かして公開する。`NODE_AUTH_TOKEN` は残し、secret がなければ空になるだけとする | 手元から公開すると、品質検査と公開するコミットの確認を通らない。トークンが空なら npm は OIDC で認証する | 承認（依頼者の「おすすめで続けて」の指示による） | 依頼者 | 2026-10-23 |
| A-05 | REQ-141 | `pnpm changeset publish` が OIDC で認証できるかは、2 回目の公開で確かめる。できなければ change を作って公開の方法を変える | 実際に公開しないと確かめられない | 承認（依頼者の「おすすめで続けて」の指示による） | 依頼者 | 2026-10-23 |
