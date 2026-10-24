# validate-evidence-records

## Why
実装全体の評価（作業記録 2026-10-23 の 42 節）で、trace report が証拠の記録を読むときに `schemaVersion` も中身の形も確かめていないことが分かった。新しい版の loomake が書いた記録や、手で書き換えた記録を、黙って読み違えたまま検収レポートを作るおそれがある。検収レポートは顧客に渡すので、読み違えたまま出すことは避けたい。

## What Changes
- trace report は、証拠の記録の `schemaVersion` が読める版でないとき、レポートが使う欄の形が違うとき、記録の `change` が change-id と違うときに、そのファイルのパスと理由を示し、使い方の誤りとして終了コード 2 を返す（REQ-073）

## Non-goals
- 証拠の記録の書き換えを見つけること（署名やハッシュの鎖）。記録は git の履歴で守る
- 古い版の記録を新しい形に移す仕組み

## Impact
- 影響する capability：trace-report（Requirement の変更）
- 影響するコード：`packages/trace/src/report.ts`
