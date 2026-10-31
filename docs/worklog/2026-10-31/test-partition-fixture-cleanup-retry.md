# partition の試験の片付けを再試行付きにする（#229）

1. やったこと：`tests/helpers/partition-fixture.ts` の `cleanup` に、`rmSync` の `maxRetries: 5` と `retryDelay: 100` を足した。Windows の CI で `.loomake/partition-fixture-*` を消すときに EPERM が出て、直前に動いた試験が落ちていたため。fixture の子プロセスはどれも `spawnSync` で動かすので、片付けの時点で子プロセスは終わっている。終了待ちは直していない。試験の期待値、時間の上限、試験名は変えていない。ほかの試験補助には広げていない。
2. verify の結果：手元（Linux）で `tests/test-partition-integration.test.ts` の 8 件が成功した。lint と typecheck も通った。Windows では手元で再現できないので、PR に `ci:all-os` を付けて CI で確かめる。
3. 残っている確認事項・仮定：EPERM の原因は、ウイルス対策ソフトか、子プロセスが終わった直後に残るファイルのハンドルだと仮定した。再試行しても消せない場合は、Issue の候補 2（Windows だけ隔離一覧に入れる）を検討する。
4. 次にやること：CI（all-os）の結果を確かめ、独立レビューを受ける。
