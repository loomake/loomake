# C001 の分割 4/6（verify-v2-scope）

1. やったこと：子 change `verify-v2-scope` のタスク 1.1〜5.1。親から REQ-312・050・323 を既存 ID のまま移し、cli の REQ-135・194・041 の差分を足した。`verify` と `trace record` に `--scope local|ci` を足し、値は `args.ts` の共通定義から usage・help・リファレンスに出す。`--scope local` と `--scope=local` はどちらも受理し、空や不正な値は終了コード 2。省いたときは `--done` が ci、`--spec-only` と `--change` なしが local で、環境変数 CI では変わらない。`--change` なしの `--scope ci` は `UsageError`（終了コード 2、`--json` では aborted）。
2. verify の結果：子の `--spec-only` と `--done`、lint、typecheck、全体試験の結果は PR 本文に記す。
3. 残っている確認事項・仮定：usage と help が変わる 27 例の個別承認が未了。承認の根拠は R-C001-05（方針の承認のみ）で、具体差分は PR 本文で個別承認を求める。基準差分の仕組みを、stderr の出力番号（entry）と複数行の新文に対応させ、仕組みの試験を合わせた。REQ-050 の試験は scope local と省略の 2 通りにした。
4. 次にやること：CI と Opus のレビューを管理役が確かめる。5/6 以降は quality.yaml の配線ほか。
