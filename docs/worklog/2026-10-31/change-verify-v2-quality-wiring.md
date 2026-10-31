# C001 の分割 5/6（verify-v2-quality）の 2 本目：runVerify への接続

1. やったこと：子 change `verify-v2-quality` のタスク 4.1〜4.4・5.1〜5.3。`verify --done` の scope ci で quality.yaml を読み、`ci.test_report` の adapter に receipt を渡して `quality:subjects` と `quality:<ID>` を足した。receipt の hash は `verify/hash.ts` の `sha256Hex` で作り、品質コマンドの終了コードが 0 以外なら未照合にした（Q-09 A）。既存の試験は期待値を変えず、quality.yaml・git・実際の Vitest・`startTime` 付きのレポートを準備に足した。既存の期待値は変えず、新しい check `quality:PQ-900` の期待を cli.test.ts の REQ-040 ci case に 1 件足した。実際の Vitest を動かす API と CLI の受入試験を 7 本足した。レビュー 1 回目の指摘に合わせて、残ったレポートの拒否理由の確認、実行中のコミットと基準の書き換えの試験、仕様ゲートとローカルの完了ゲートでの権限不足（3）と不正（2）の確認を足した。
2. verify の結果：`verify --change verify-v2-quality --done` は exit 0 で、このリポジトリ自身の判定でも `quality:PQ-900` が PASS になった。`--spec-only` は verify-v2-quality と verify-v2-c001 のどちらも exit 0。lint・typecheck・全体試験も成功した。
3. 残っている確認事項・仮定：Q-02〜Q-08 は利用者が承認した（Q-08 は A で、環境の照合は S1 で扱う）。Q-09 は管理役（Claude Fable 5.1）が A に決めた。未回答の確認事項はない。差分は文脈行なしで約 73 KiB で、管理役の判断で 1 本の PR にした。
4. 次にやること：独立レビューと 3 OS の CI を通してマージする。その次は C001 の 6/6（verify-v2-c001 の受入）に進む。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| #236 | 対象外（design-step8b で代替） | 完了 | CI 待ち | 1 回 | マージ待ち |
