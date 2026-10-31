# トークン使用量の記録

`tokens.csv` には、Loomake の開発で使ったトークンの量を、日本時間の日付・ツール・モデルごとに 1 行ずつ記録します。配布ワークフロー改善ダッシュボードの更新 routine は、このファイルを読んでトークンの欄を作ります。

## 列

数値の単位はすべてトークン数です（`requests` だけは応答の数）。

| 列 | 意味 |
|---|---|
| `day` | 日本時間の日付（YYYY-MM-DD） |
| `tool` | `claude-code` か `codex` |
| `model` | 応答したモデルの識別子 |
| `input` | キャッシュを使わなかった入力 |
| `cache_write` | キャッシュに書き込んだ入力 |
| `cache_read` | キャッシュから読んだ入力 |
| `output` | 出力 |
| `requests` | 応答の数 |

行は `day`・`tool`・`model` の順に並びます。同じログからは同じ CSV ができるので、更新した日ごとの違いを差分で確かめられます。

## 更新の仕方

開発機では、Claude Code のセッションを始めるたびに SessionStart hook が `scripts/metrics-tokens.py` を実行し、手元の `.loomake/metrics/tokens.csv`（git の管理外）を作り直します。hook は各自の `~/.claude/settings.json` に入れます。

リポジトリの `docs/metrics/tokens.csv` を更新するときは、リポジトリのルートで `scripts/metrics-tokens-pr.sh` を実行します。CSV を作り直し、origin/main と違うときだけ、ブランチ `metrics/tokens-<日付>` で L1 の PR を出します。`--dry-run` を付けると、PR の中身を表示するだけで、ブランチも PR も作りません。

集計だけを見たいときは、`python3 -I scripts/metrics-tokens.py` を実行すると標準出力に CSV が出ます。`--out <path>` で出力先を、`--since <YYYY-MM-DD>` で集計を始める日を指定できます。`--since` の既定は 2026-10-22 です。

## 注意

出典は、スクリプトを実行した開発機にある Claude Code（`~/.claude/projects` のうち loomake のもの）と Codex（`~/.codex/sessions`）のログだけです。ほかの端末やクラウドのセッションで使った分は含みません。CSV には日付・ツール名・モデル名・数値だけを書きます。セッションの本文やファイルのパスは書きません。
