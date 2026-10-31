# partition の試験の片付けを再試行付きにする（#229）

1. やったこと：`tests/helpers/partition-fixture.ts` に、削除を再試行する関数 `removeWithRetry` を足した。EPERM・EACCES・EBUSY・ENOTEMPTY のときに、最大 10 回まで、待ち時間を 100 ミリ秒ずつ延ばしてやり直す。fixture の `cleanup` と、同じ補助の `reset`・`run` の中のファイル削除にこの関数を使う。最初は `rmSync` の `maxRetries` を使った。しかし自前の再試行に替えた。CI は `node-version: 24` でマイナー版を固定しておらず、v24.0.0 など古い 24 系の `rmSync` は、Issue のログと同じ Windows の「Permission denied」の EPERM を再試行しない（CI の v24.22.1 は再試行する）。また Linux・macOS では、`rmSync` の 100 ミリ秒の待ちが 0 秒に切り捨てられる。試験の期待値、時間の上限、試験名は変えていない。
2. verify の結果：手元（Linux）で `tests/test-partition-integration.test.ts` の 8 件が成功した。lint と typecheck も通った。Windows では手元で再現できないので、PR に `ci:all-os` を付けて CI で確かめる。
3. 残っている確認事項・仮定：fixture の子プロセスは `spawnSync` で動かすので、直接の子は片付けの前に終わっている。Vitest の worker（孫プロセス）が終わるまで待つことは保証していない。EPERM の原因は、ウイルス対策ソフトか、子プロセスが終わった直後に残るファイルのハンドルだと仮定した。再試行しても消せない場合は、Issue の候補 2（Windows だけ隔離一覧に入れる）を検討する。
4. 次にやること：CI（all-os）の結果を確かめ、独立レビューを受ける。
