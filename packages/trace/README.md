# @loomake/trace

[loomake](https://www.npmjs.com/package/loomake) の内部用パッケージ。証拠の記録（trace record）とリリースレポート（trace report）。

直接は使わず、CLI の `loomake` を使う。版が `0.y.z` のあいだは、API が予告なく変わることがある。

詳しくは [GitHub のリポジトリ](https://github.com/loomake/loomake)を見る。

## 人の実作業時間の入力

`parseDuration` は `90m`・`1.5h`・`0.05h` を整数分へ正確に変換する。各値は0〜100000分で、単位なし、先頭ゼロ、空白、符号、指数表記、丸めが必要な値は拒否する。`parseEffortOption` は総計か、`instruct=30m,review=20m,search=8m` のような区分を受け付ける。区分は instruct・review・rework・run・wait と、その内数の search である。省略は0にせず、searchだけの指定や既知5区分の和を超える内数は拒否する。

`parseCost` は `actual-usd:1.25,estimated-usd:0.50,tokens:12000` を受け付け、USDは整数cents、tokensは整数countへ分けて変換する。同じ区分の反復と安全整数の上限超過を拒否し、異なる費用を合算しない。これらは同期関数である。

`runEffortRecord({ root, changeId, effort, stdout, decisions?, attempts?, cost?, note?, now? })` は、active または一意な archive 済み change へ同期で追記する。未コミットの変更と同じ保存名の衝突は1、使い方や保存の誤りは `UsageError` とする。総計と付帯値を推定せず、指定された値だけを保存し、verifyや検証文書の読取を行わない。

メモは Unicode codepoint で500文字以内とし、改行と制御文字を拒否する。秘密情報や個人情報を入力しない。kit の共通置換は既知の形だけを対象とし、置換後にも構造と64KiBの上限を検査する。古い記録は変更せず、記録したファイルは git にコミットする。

## ライセンス

MIT
