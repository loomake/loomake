# improve-project-onboarding

## Why
init のあと、利用者が自分で整える設定が残る。テストのレポートを `.gitignore` で除外していないと、`loomake run` は始める前に止まる。設定が足りているかを確かめる手段もなく、`--help`・`--version` もないので、ドキュメントと行き来する必要がある。docs/evaluation.md の「使いやすさ」と 2026-10-24 の追加評価の改善 4 で指摘された。

## What Changes
- `loomake init` は、`.gitignore` にテストのレポートの出力先を足す。既存の行は変えず、証拠の記録（`.loomake/evidence/`）はコミットできるままにする（REQ-133）
- `loomake doctor` を足す。設定ファイル、OpenSpec、品質コマンド、Git の除外の状態、使う CLI を調べ、問題ごとに直し方を表示する。何も変更せず、品質コマンドも実行しない（REQ-134）
- `--help`・`--version` と、サブコマンドごとの `--help` を足す（REQ-135）

## Non-goals
- テストランナーの設定ファイルを自動で書き換えること
- doctor が問題を自動で直すこと
- doctor がネットワークに接続して、gh のログイン状態などを確かめること
- docs/usage.md と README.md の更新（利用者が編集中のため、別に行う）

## Impact
- 影響する capability：init（Requirement の追加）、doctor（新規）、cli（新規）
- 影響するコード：`packages/kit/src/init/init.ts`、`packages/kit/src/doctor/`（新規）、`packages/cli/src/main.ts`
