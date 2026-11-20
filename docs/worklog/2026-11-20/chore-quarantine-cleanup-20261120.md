# chore/quarantine-cleanup-20261120（L2）

1. やったこと：利用者が 2026-11-20 に承認した 2 点に沿って隔離一覧を整理した。承認 1「通る 5 件を外し 2 件だけ延長」で、tests/quarantine.json から guards・pr・publication-retry・guards-special-files・delivery-opus-prior を外し、ai-journeys（#181）と package-artifacts（#183）は追加日を 2026-11-20、期限を 2026-12-04 にした。承認 2「試験側で改行をそろえる」で、tests/package-artifacts.test.ts の 1 か所を、`\r\n` を `\n` にそろえてから同じ断片を探す形にした。docs/dev/ci.md に現状を足した。
2. 検証：Linux で ci-quarantine.test.ts・ci-quarantine-workflow.test.ts・test-partition-integration.test.ts が通った（23 件）。`ci-quarantine.mjs` は 12/4 まで終了コード 0、12/5 で 2。CRLF の本文では、そろえる前は断片が見つからず、そろえたあとは見つかることを手元で確かめた。package-artifacts.test.ts は Linux で 25 件通り、REQ-146 の 1 件だけが開発機の高負荷（load 37）の中で失敗した（この変更とは無関係と見ているが、原因は未確定）。CI の結果は PR に書く。
3. 確認事項・仮定：期限の規則（追加日から 14 日以内）に合わせるため、延長した 2 件は追加日も 2026-11-20 に更新した。package-artifacts は REQ-324・325 の 60 秒超過が残るため、安定を確かめてから別の PR で外す。外した試験がまた不安定なら、再隔離は利用者に相談する。
4. 次：CI（mac・Windows の quality と quality-quarantine）の結果を確かめる。review は監督役が別に起こす。マージは未実施。
