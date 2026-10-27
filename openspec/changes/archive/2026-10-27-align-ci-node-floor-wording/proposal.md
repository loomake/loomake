# align-ci-node-floor-wording

## Why
monorepo の Requirement「対応環境での配布物の検証」（REQ-144）は、CI が「実行時下限Node20.19.0」で配布物を検証すると書いている。一方、同じ仕様の「Node.js のバージョン宣言」（REQ-142）は、配布物の下限を `>=22.12.0` とし、Node 22.12.0 で CLI が動くかを CI で確かめると定めている。`.github/workflows/ci.yml` の node20 ジョブにも「過去の下限Node20での追加確認。配布物の宣言する下限は下のnode22で検証する」とあり、docs/compatibility.md も下限を 22.12 に揃えたと書いている。REQ-144 の文言だけが、Node 20.19.0 を今の下限と読める形で残っている。

## What Changes
- REQ-144 の本文を MODIFIED で直し、Node 20.19.0 での検証が過去の下限での追加確認であり、配布物の宣言する下限は REQ-142 の Node 22.12.0 だと分かる文言にする
- Scenario「Node下限で検査する」の WHEN を、Node 20.19.0 が過去の下限だと分かる言い方にする。OpenSpec の MODIFIED では Scenario の名前を変えられないため、名前は残す。THEN は変えない

## Non-goals
- CI の振る舞いを変えること。`.github/workflows/ci.yml` と、tests/package-workflows.test.ts の [REQ-144] のテストの期待値は変えない
- monorepo の Purpose を直すこと（archive では反映されず、AGENTS.md 4 章の例外にも当たらない）

## Impact
- 影響する capability：monorepo（REQ-144 の文言だけ）
- 影響するコード：なし
- 利用者に見える変更：なし
