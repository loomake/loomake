# Tasks

## 1. 計画と承認

- [x] 1.1 proposal・差分仕様・design・traceを揃え、REQ-322全文と既存3 Scenarioを保持する。strict成功と、spec-onlyがT-URL-01未回答だけで失敗することを確認する
- [ ] 1.2 T-URL-01の人の回答・承認元をtraceへ記録し、承認された範囲を照合する。`pnpm -s verify --change fix-quality-reference-source-links --spec-only` がexit 0になることを確認する。承認前は製品・生成ページ・試験を編集しない

## 2. 生成元リンクと回帰試験

- [ ] 2.1 T-URL-01の承認後、示した既存1 assertionだけを置き換える。REQ-322付きでrenderer/保存ページの2つのラベルとhrefの完全一致・各1回・通常ファイルのisFile確認・GitHub baseと末尾slashあり/なしの両サイトbaseからのURL解決を試験し、未修正のrendererでは失敗することを確認する。他の既存期待値を保持する
- [ ] 2.2 rendererの2つの相対hrefを差分仕様のGitHub URLへ変え、既存コマンドでページを再生成する。関連試験と生成物checkを成功させ、ページ差分1行と、生成表・title/description・再生成方法・他の導線とREQ-320/321の不変、再生成の繰返しで差分なしを確認する

## 3. 統合確認

- [ ] 3.1 strict・関連試験・lint/typecheckと `pnpm -s verify --change fix-quality-reference-source-links --done` を成功させる。固定site/docs SHAで描画後の2 href、REQ-322対応試験と全タスク、対象headの必須CIと別の新しいOpus sessionの最終レビューを確認する。自動bot用1枠を確保し、設計生成とAI評価を区別して回数を記録する。担当・モデル不明や代替・未実施工程はagent-workflowに従って記録する <!-- loomake:gate=done -->

この計画整合時点のAI評価は0回。設計レビューと最終レビューは未実施で、設計生成を評価へ数えない。最終レビューは後日の別Opus session、自動bot予定分は1枠を確保する。

## Workflow follow-up

- 対象headの受入後、管理役が承認範囲を確認し、マージ・仕様反映・archiveへ進む。このchangeだけで#103全体をcloseせず、公開・リリースを行わない。
