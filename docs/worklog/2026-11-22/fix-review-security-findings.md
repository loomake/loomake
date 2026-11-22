# 2026-11-22 fix/review-security-findings

## コードベース全体のレビュー（実装・構成・セキュリティ）

- やったこと：packages/（core・kit・trace・runner・cli）の全ソース、CI のワークフロー、スクリプト、docs/security.md などを読み、実装の構成・品質・セキュリティを評価した。品質コマンドも実行した
- verify の結果：`pnpm typecheck`・`pnpm test`（72 ファイル・1007 件）はすべて合格。`pnpm lint` はこのコンテナのメモリ（空き約 2GB）でヒープ不足になり中止（環境起因。CI で要確認）。`pnpm audit` は moderate 1 件（minimatch、dev 依存のみ）
- 残っている確認事項・仮定：
  - （中）verify のコマンド出力 detail がマスクされないまま証拠 JSON にコミットされ、完了ゲート不合格時はエンジンの指示にも載る。秘密情報が Git 履歴と AI API に出る可能性
  - （中）`loomake verify` 単体実行（予算なし）は `spawnSync` 直打ちで監視役が効かない
  - （低）`tests.report` のパスを verify --done が無条件に rmSync する。設定ミスで任意のファイルを消せる
  - （低）Windows の `quote()`：`"` が欠落し、`%VAR%` が引用内でも展開される
  - （低）`git add -A`+commit に秘密情報らしいファイルの検査がない
  - （低）docs/architecture.md の一部に古い記述（zod・yaml・parseArgs）が残っている
- 次にやること：上の指摘を修正する

## レビュー指摘の修正

- やったこと：レビューで挙げた指摘を修正した
  - （中）verify の品質コマンドの出力に `maskSecrets` を適用し、証拠・プロンプトへの秘密情報の流出を止めた（kit の `runtime/redact.js` から import）
  - （中）verify の品質コマンドを常に監視役（supervisor）経由に変え、出力の上限と子プロセスグループの掃除を効かせた。予算・期限なしの呼び出しは `runExternal` が有限の遠い期限を監視役へ渡す形にした（時間の上限そのものは引き続き timeoutMs・共有予算で制御）
  - （低）`tests.report` のパス検証は main で `normalizeReportPath`・`assertReportTarget` として対応済みだったため、このブランチでは追加しない
  - （低）Windows の `quote()` を CommandLineToArgvW の規則（`\` と `"` の逃がし方）に直し、`%VAR%` 展開を `%%` で止めた
  - （低）`findViolations` に秘密情報の検査を追加：`id_rsa`・`*.pem`・`.env`・`credentials.json` などのファイル名（見本の `.env.example` などは許す）と、差分の追加行に既知形式のトークン・秘密鍵ブロックがあれば検出する
  - （低）`runClaude` のタイマー上限は main で対応済みだったため、このブランチでは追加しない
  - （低）docs/architecture.md の残っていた古い記述（zod・yaml の実行時依存、標準 parseArgs）を実装に合わせた。改版履歴に v2.5.6 を追記
  - minimatch の ReDoS は `pnpm-workspace.yaml` の overrides で `>=11.0.1` に固定（11.0.9 が解決）
- verify の結果：`pnpm typecheck`・`pnpm -r build`・`pnpm test` すべて合格。`pnpm audit` は「No known vulnerabilities found」。lint は前回同様この環境のメモリでは未確認
- 残っている確認事項・仮定：
  - verify 単体実行の時間上限は「監視役経由＋出力上限＋プロセスグループ掃除」までに留めた。壁時計の上限を設けると正当な長いテストを止め得るため、timeoutMs または共有予算での制御は仕様上の判断事項として残す
  - guards の秘密情報検査は既知形式のみ。任意のパスワード等は文書どおり対象外
- 次にやること：main の進捗を取り込んで PR を更新し、CI を待ってマージする
