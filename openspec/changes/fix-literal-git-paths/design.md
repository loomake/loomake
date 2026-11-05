## Context

[Issue #414](https://github.com/loomake/loomake/issues/414) の修理設計を再利用する。`git diff --cached --name-status -z` で読んだ名前を再び pathspec として渡すと、ガードが別のパスを選び差分を見落とす。REQ-109 のテスト全般の検出を修理し、REQ-138 の特殊文字パスの回帰として記録する。

## Goals / Non-Goals

- 既存の検出規則・差分表示・停止後の扱いを保ち、ファイル名の解釈だけを直す。
- `git()` と直接 `runExternal('git', ...)` を呼ぶ経路に同じ git 環境を渡す。
- git の引数、フックが動く操作の残り時間、環境のほかの値は変えない。

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
