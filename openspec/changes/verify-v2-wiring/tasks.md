# Tasks

## 1. 仕様

- [ ] 1.1 子changeを作る。親からREQ-040・041・100・311・315を移し、REQ-042は既存仕様で充足として台帳に置く。管理役承認の逸脱と仮定をtraceに書く。`verify --spec-only` が0になることを確かめる

## 2. 書き出しの切替

- [ ] 2.1 core：現行のverify結果を2.0.0、Evidenceを2へ切り替える。版付きでないverify・evidenceのJSON Schemaを現行版にし、schema-historyに2.0.0を足す（子change `verify-v2-shape` のREQ-276・302〜305・307の現行版への切替）
- [ ] 2.2 kit：`runVerify` を2.0.0にし、scopeを受け取る。結果を組み立てる側で、partialのciにPASSを出さず、localのpartialでは未完了を1以上にし、0件と全件NOT_APPLICABLEをPASSにしない。`formatVerifyResult` を合わせる（REQ-040・311）
- [ ] 2.3 CLI：`verify --json` を2.0.0にし、終了コードを `verifyExitCode` で決める。使い方と設定の誤りは `--json` のときabortedを出す（REQ-041・311、REQ-042）
- [ ] 2.4 trace：recordをEvidence 2にし、scope（省略時ci）とverifyと同じ終了コードを使う（REQ-315）
- [ ] 2.5 runner：完了ゲートと証拠の記録をscope:localに固定する。既存の試験を2.0.0の結果に合わせる（REQ-100）

## 3. 受入

- [ ] 3.1 REQ-050の性能の試験で、`--skip-commands` の実行とレポートの解析・要件の対応の判定を合わせて3秒以内に収まることを確かめる
- [ ] 3.2 配布物の検査、互換性の文書、root `quality.yaml`、changeset（core・kit・trace・CLI minor、runner patch）を足す
- [ ] 3.3 lint・typecheck・全体の試験。`pnpm -s verify --change verify-v2-wiring --done` を通す <!-- loomake:gate=done -->
