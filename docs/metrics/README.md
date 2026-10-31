# トークン使用量の記録

Loomake の開発で使ったトークンの量を、日本時間の日付・ツール・モデルごとに 1 行ずつ CSV に記録します。配布ワークフロー改善ダッシュボードの更新 routine は、この CSV を読んでトークンの欄を作ります。

## 置き場所

CSV は、データ専用のブランチ `metrics-data` の `tokens.csv` にあります。main には入れません。main に入れると、データを更新するたびに PR と段階の判定が要るためです。リポジトリは公開されているので、`metrics-data` の CSV（日付・ツール・モデル名・トークン数）も誰でも読めます。

次のどちらかで読めます。

```sh
gh api 'repos/loomake/loomake/contents/tokens.csv?ref=metrics-data' -H 'Accept: application/vnd.github.raw'
curl -fsSL https://raw.githubusercontent.com/loomake/loomake/metrics-data/tokens.csv
```

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

行は `day`・`tool`・`model` の順に並びます。同じログからは同じ CSV ができるので、更新した日ごとの違いを `metrics-data` の履歴で確かめられます。

## 更新の仕方

`metrics-data` の CSV を更新するときは、開発機のリポジトリで `bash scripts/metrics-tokens-push.sh` を実行します。CSV を一時ファイルに作り、`metrics-data` の `tokens.csv` と違うときだけ、その 1 ファイルを差し替えたコミットを `metrics-data` に直接 push します。PR は作りません。作業ツリーにも書き込みません。`metrics-data` がまだ無いときは、新しく作ります。

`--dry-run` を付けると、CSV の生成と比較だけを行い、差分の有無と予定のコミットを表示して止まります。`--no-generate <path>` を付けると、ログを集計せずに、指定した CSV をそのまま使います。指定した CSV の 1 行目が列の見出し（`day,tool,model,input,cache_write,cache_read,output,requests`）と違うときは、取り違えを防ぐため終了コード 2 で止まり、push しません。

初回の CSV も、利用者が開発機でこのスクリプトを実行して入れます。Claude のサブエージェントに任せると、手元のログの読み取りが自動モードの権限で拒否されるためです。

手元の CSV を毎回新しくしておきたい利用者は、各自の `~/.claude/settings.json` に SessionStart hook を入れます。hook で `python3 -I scripts/metrics-tokens.py --out .loomake/metrics/tokens.csv` を実行するようにしておくと、Claude Code のセッションを始めるたびに、手元の `.loomake/metrics/tokens.csv`（git の管理外）が作り直されます。

集計だけを見たいときは、`python3 -I scripts/metrics-tokens.py` を実行すると標準出力に CSV が出ます。`--out <path>` で出力先を、`--since <YYYY-MM-DD>` で集計を始める日を指定できます。`--since` の既定は 2026-10-22 です。

## 注意

出典は、スクリプトを実行した開発機にある Claude Code（`~/.claude/projects` のうち loomake のもの）と Codex（`~/.codex/sessions`）のログだけです。ほかの端末やクラウドのセッションで使った分は含みません。CSV には日付・ツール名・モデル名・数値だけを書きます。セッションの本文やファイルのパスは書きません。
