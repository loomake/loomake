# 速度対策1-1（PR184）

1. `split-slow-ci-checks`の2.5で登録済みcompanionの監査と独立AST宣言検査を実装し、2.6で条件付きfactory・型だけの配列wrapperの分類と、旧15＋移動先2の17file必須包含を追加した。元REQ-347の本文・3つのScenario・Source、raw report・レビュー表、元case本文・parameter・assert・timeout・skip、scanner・partition・Vitest・実registry空を保った。採集対象は17fileへ限定せず全file・全caseのままとした。
2. mainの期限試験移動・Git集約・quality receipt接続を取り込み、旧本文保持と新しい2宣言を独立照合した。関連222件、build、型検査、lint、spec-only、strict、差分検査が成功した。2.6の別Codex点検も85件が成功し、未解決の重大・軽微指摘はゼロだった。前段CIは全3OS・Node22・CodeQL・隔離試験が成功し、gateは未完了タスクで失敗した。
3. 分割前の旧全件測定9本は7成功・Windows2失敗で未受入である。前段のTemp導入120秒失敗はIssue181に保持し、新headの1回成功で安定修理としない。新2fileの欠落試験とspread factoryの境界は修正前の失敗を保存し、修正後の成功を確認した。V1のmock/import合成fixtureや同じit.eachの本文hashを、production・3OS・全parameter保持の証明へ流用しない。
4. 計画整合で進捗は8/18、完了ゲート後の必須受入4件も未達とした。最新全件測定は9本のうち7成功・Windows2失敗で、構造監査の成功と実試験の失敗を分け、全原本を保持した。段階的PRでも監査と宣言検査は同じPRとし、Node20削除と全PRのslow不実施は最後のPRに残す。残設計、publication後継診断、実case分割、全PRのslow不実施、REQ-297の時間上下限と時計、coverage、local/release全件、人のnode20-only規則操作、独立最終レビュー・マージ・マージ後初回の実診断3sample・sync/archiveを残す。行登録のV2手書き基準と後継診断producerの互換は、次の実装前に確認する。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [184](https://github.com/loomake/loomake/pull/184) | 残個別設計・V2原理実験・後継診断の受入 | 進行中（8/18） | 全件9本は7成功・2失敗、次のコードheadは未受入 | 最終レビュー未実施 | 必須受入未達・未マージ |
