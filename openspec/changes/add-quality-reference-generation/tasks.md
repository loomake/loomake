# Tasks

#60の仕様反映・archive受入と仕様ゲート成功を確認した。既存delivery指示に基づくapply作業として、以下の順に実装する。

## 1. 仕様と依存

- [x] 1.1 proposal・specs・design・tasks・traceを用意し、OpenSpec strictと仕様ゲートの結果を記録する。CLI後続と#60受入待ちを明記し、新規IDがREQ-320〜322だけであることを確認する
- [x] 1.2 #60の仕様反映・archive受入を確認し、Issueの根拠を作業記録へ残す。採用済みのquality先行範囲を再確認して仕様ゲートexit 0を確かめる

## 2. 生成と直接試験

- [x] 2.1 入力JSON Schemaから全項目を描画するrendererを追加し、object・record・配列・NA分岐・親/子のdefault・型/制約・未記載description・特殊文字をID付き試験で確かめる。スキーマにないmetric/sourceの意味を足していないことと既存schemaの省略時解析結果との対応も確認する（REQ-320・322）
- [ ] 2.2 生成スクリプトと読み取り専用checkを追加し、一時領域で一致0、欠落/改変/エラーの非0、失敗時の非書換え、CRLF、繰り返しの同一出力をID付き試験で確認する。生成/checkの操作手順をdocs/devへ記す（REQ-321）

## 3. 生成ページと既存経路への接続

- [ ] 3.1 実スキーマからqualityページを生成してguide入口にリンクし、全階層の期待パス・NA必須条件・既定値と再生成内容が保存済みページに一致するID付き試験を追加する。既存doc-links試験とtitle/description・既存3ページの導線を確認する（REQ-320〜322）
- [ ] 3.2 既存pnpm test/完了ゲートで再生成不一致が失敗することを確認し、既存CIのskip・設定を緩めずに接続する。公開8 JSON・型/exports・製品コードとCLIに不要な変更がないことを確認し、空のchangesetと開発手順を揃える（REQ-321・322）

## 4. 受入確認

- [ ] 4.1 関連ID付き試験・既存JSON Schema一致・文書リンク・lint・typecheckを通し、独立レビューと最終headの通常の完了ゲート/必須CIを確認する。CLI生成が残るため#104全体をcloseしないことを記録する <!-- loomake:gate=done -->
