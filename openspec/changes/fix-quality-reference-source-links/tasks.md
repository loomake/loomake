# Tasks

## 1. 計画と承認

- [x] 1.1 proposal・差分仕様・design・traceを揃え、REQ-322全文と既存3 Scenarioを保持する。strict成功と、spec-onlyがT-URL-01未回答だけで失敗することを確認する
- [ ] 1.2 T-URL-01の人の回答・承認元をtraceへ記録し、承認された範囲を照合する。`pnpm -s verify --change fix-quality-reference-source-links --spec-only` がexit 0になることを確認する。承認前は製品・生成ページ・試験を編集しない

## 2. 生成元リンクと回帰試験

- [ ] 2.1 T-URL-01の承認後、示した既存1 assertionだけを置き換える。REQ-322付きでrenderer/保存ページの2つのラベルとhrefの完全一致・各1回・通常ファイルの実在・GitHub/サイトからのURL解決を試験し、未修正のrendererでは失敗することを確認する。他の既存期待値を保持する
- [ ] 2.2 rendererの2つの相対hrefを差分仕様のGitHub URLへ変え、既存コマンドでページを再生成する。関連試験と生成物checkを成功させ、生成表・title/description・再生成方法・他の導線とREQ-320/321の不変を確認する

## 3. 統合確認

- [ ] 3.1 strict・関連試験・lint/typecheckと `pnpm -s verify --change fix-quality-reference-source-links --done` を成功させる。固定site/docs SHAで描画後の2 href、REQ-322対応試験と全タスク、対象headの必須CIと独立レビューを確認する。担当・モデル不明や代替・未実施工程はagent-workflowに従って記録する <!-- loomake:gate=done -->

## Workflow follow-up

- 対象headの受入後、管理役が承認範囲を確認し、マージ・仕様反映・archiveへ進む。このchangeだけで#103全体をcloseせず、公開・リリースを行わない。
