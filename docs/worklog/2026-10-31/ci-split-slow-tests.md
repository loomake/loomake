# 速度対策1-1（PR184）

1. `split-slow-ci-checks`の2.5でcompanion監査と独立AST検査、2.6でfactory・型だけの配列wrapperと旧15＋移動先2の17file必須包含を実装した。REQ-347元本文・3Scenario・Source、rawとレビュー表、元caseの名前・parameter・assert・timeout・skipとscanner・partition・Vitest・実registry空を保ち、採集は全file・全caseのままとした。
2. mainの期限試験移動・Git集約・quality receiptを取り込んで元本文と追加2宣言を独立照合し、関連222件・2.6の別Codex点検85件・build・型・lintが成功、今回の計画更新もspec-only・strict・差分検査が成功した。前段CIは全3OS・Node22・CodeQL・隔離試験が成功し、gateは未完了タスクで失敗した。
3. 最新全件9本は17必須・155fileを含み7成功・Windows2失敗で、旧全件9本の失敗、Issue181のTemp導入120秒失敗と全原本も保持し、1回の成功で安定修理としない。新2file欠測とspread factoryの修正前失敗・修正後成功、旧V2停止を残し、訂正設計のV2b報告は管理役が全文を読んでV1と同じくLinux合成の技術前提に限って採用し、production・3OS・全parameter保持や本文hashだけの証明へ流用しない。
4. 進捗は8/20と必須受入4件未達で、未完2.8の19file包含/schema基準・新2.9のimported helper分類と独立実証・v2-readers登録後20包含、A2事前基準・全file解除/唯一Source・F-A2/producer互換を次に確認する。監査とinventoryは同一の段階的PR、Node20削除と全PRslow不実施は最後184に保ち、残設計・実登録/OS割当・独立全case比較・REQ-297上下限/時計・coverage・local/release全件・人の規則操作・最終レビュー/マージ・初回main診断3sample・sync/archiveの受入を残す。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 残個別設計・行登録基盤・後継診断の受入 | 進行中（8/20） | 全件9本は7成功・2失敗、次のコードheadは未受入 | 最終レビュー未実施 | 必須受入未達・未マージ |
