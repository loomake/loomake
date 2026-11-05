## Context

[Issue #414](https://github.com/loomake/loomake/issues/414) の修理設計を再利用する。`git diff --cached --name-status -z` で読んだ名前を再び pathspec として渡すと、ガードが別のパスを選び差分を見落とす。REQ-109 のテスト全般の検出を修理し、REQ-138 の特殊文字パスの回帰として記録する。

## Goals / Non-Goals

- 既存の検出規則・差分表示・停止後の扱いを保ち、ファイル名の解釈だけを直す。
- `git()` と直接 `runExternal('git', ...)` を呼ぶ経路に同じ git 環境を渡す。
- check-ignore の先頭コロンへの接頭辞を除き git の引数を保つ。フックが動く操作の残り時間、環境のほかの値は変えない。

## Decisions

- Issue の案どおり `GIT_LITERAL_PATHSPECS=1` を実行時の環境へ加える。`--literal-pathspecs` を引数の先頭へ足す案では `args[0]` による commit・push の期限判定が変わるため、環境で指定する。
- `GIT_TERMINAL_PROMPT=0` と合わせて環境を作り、branchExists・gitConfig・isIgnored・readHead、guards の直接 git 呼び出しにも適用する。呼び出し側が渡した環境は変更しない。
- runner の git 呼び出しを調べた結果、glob に依存する引数はない。`add -A` は全件の登録、tasks・evidence の `add --` は実際の相対パス、ガードの diff は git から取得した実際の名前である。
- 規範文と既存 Scenario は変えず、3 つの既存 Requirement に回帰 Scenario を追加する。新しい製品要件や REQ 番号は追加しない。

## Risks / Trade-offs

- [Windows ではコロンを含むファイル名を作れない] → 実ファイルの魔法構文の再現は POSIX で行い、全 OS で偽の git が環境の指定と既存の特殊文字パスの扱いを確認する。
- [直接呼び出す経路の取り残し] → runner 内の全 `runExternal('git', ...)` を確認し、正常な HEAD 読み取りとフォールバックも検証する。
- [他の git 操作への副作用] → 証拠と tasks のパス、add -A、check-ignore、既存の git 読み取り・認証・ガード試験を確認する。

## Migration Plan

runner の patch changeset として配る。CLI オプション、公開 JSON、依存、利用者の設定の移行はない。

## 確認済みの互換処理

Q-414-01 は 2026-11-05 の利用者の回答で A が承認された。[提示差分](https://github.com/loomake/loomake/issues/414#issuecomment-6647986907) に従う。Git 2.56.0 では check-ignore に GIT_LITERAL_PATHSPECS=1 を渡すと終了コード 128 になる。承認された A はコピーした環境で通常経路を literal=1・GLOB/NOGLOB/ICASE=0 に固定し、check-ignore だけ literal=0 にして先頭コロンの名前へ ./ を付ける。普通の名前、4 種の魔法構文、角括弧、空白、改行、不存在のレポートと root 限定の除外を一時リポジトリで比較し、30 ケースの結果を .loomake/check-ignore-414-results.json に保存した。この処理で元の環境を変えずに実ファイル名を判定する。

## 独立レビュー C-1 の修理

REQ-198 の既存フックを保つため、`RUNS_HOOKS` の commit・push だけは元の環境をコピーして `GIT_TERMINAL_PROMPT=0` を加える。pathspec の 4 変数は元の値と未設定の状態を保つ。両操作の引数はコミットのメッセージや ref であり、pathspec を含まない。ガードとファイルの登録には従来のリテラル処理を適用する。最初の「全 git 呼び出し」の設計がフックにも継承される点を見落としていたため、既存規範を守るこの例外を加える。

pre-commit と pre-push に実フックを置き、フック内の `git ls-files -- '*.ts'` が対象を返すこと、pathspec 環境の 4 変数が元の値または未設定のままであること、prompt=0 を検証する。M-1 にはアサーション削除で run 全体が止まる試験を加え、M-2 の確認事項表の空行も除く。
