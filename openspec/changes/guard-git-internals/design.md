# Design

## Context

run はエンジンを呼んだあと、`git add -A` と `git commit` を自分で実行する。git は `.git/config` の `filter.*` を `git add` で、フックを `git commit` で実行する。

## Goals / Non-Goals

エンジンが書き換えた git の設定とフックを、run が実行する前に見つけて止まる。利用者が前から置いているフック（lint-staged など）は無効にしない。エンジンが Claude Code の外で直接コマンドを動かすことは、権限の設定とコンテナで防ぐ（対象外）。

## Decisions

- `git rev-parse --git-path config` と `--git-path hooks` で場所を求める。`--git-path hooks` は `core.hooksPath` を反映する
- 設定ファイルの中身と、フックのディレクトリにあるファイルの相対パスと中身から SHA-256 を作り、エンジンを呼ぶ前後で比べる。フックのディレクトリがなければ空とみなす
- 変わっていたら、HEAD の変化と同じく、変えたことを表示して止まる。run は書き換えを戻さない（エンジンのフックを run が実行しないことが目的で、戻すかどうかは人が決める）
- 秘密情報の形は、よく知られた接頭辞と形に限る。誤検出で通常の出力を隠しすぎないよう、長さの下限を付ける

## Risks / Trade-offs

フックのディレクトリが大きいと読む量が増える。フックは通常数個なので、上限は設けない。
