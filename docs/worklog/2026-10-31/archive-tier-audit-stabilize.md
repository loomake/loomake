# tier-ci-gate と stabilize-cross-os-tests の archive

1. やったこと：main にマージ済みの change `tier-ci-gate`（#188）と `stabilize-cross-os-tests`（#190）を archive し、差分を主仕様に反映した。agents-rules の作業記録の Requirement の Source は REQ-273 から REQ-288 に変わった。`scenario-audit-scope`（#189）は archive を見送った。
2. verify の結果：3 つの change とも、archive 前の `pnpm -s verify --change <id> --done` は合格した。archive 後の `openspec validate --specs --strict` は 30 件すべて合格した。scenario-audit-scope を反映すると、REQ-189 の Requirement の本文が 500 字を超えて strict の検査で失敗する。
3. 残っている確認事項・仮定：scenario-audit-scope の archive の進め方は未定。REQ-189 の本文を分ける change を先に作り、そのあとで archive する案を勧める。主仕様を直接直すことと、archive する change の本文を書き換えることは禁じられているため。Scenario 監査の件数は、全件が 656 から 695 に、未確認が 183 から 222 に増え、未着手は 201 から 143 に減った。台帳は変えていない。
4. 次にやること：scenario-audit-scope の扱いを決めたあと、残りの archive を行う。verify-v2-shape は C001 の 3 本目のあとに archive する。
