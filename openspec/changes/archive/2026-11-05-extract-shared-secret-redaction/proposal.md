# extract-shared-secret-redaction

## Why

Issue [#65](https://github.com/loomake/loomake/issues/65)（W1-6）は、外部ツールの出力を収集し、秘密を保存前に置き換えることを要求している。現在の置換処理は runner にあり、kit と trace は依存の向きを守ったまま共有できない。出典は `docs/requirements/loomake-v0.11.md` の NFR-09、`docs/architecture.md` 0.1・4章、`docs/wbs/baseline-v1.4.md` W1-6。

管理役は Opus 設計に従い、#65 を P1「共通の置換処理」、P2「五つのツールの変換と収集」、P3「verify と trace の保存・表示」に分けた。これは P1 だけの通常 L3 change である。各 change で通常の完了条件を満たし、P1 だけで #65 を閉じない。

## What Changes

- kit の `runtime/redact.ts` と `runtime/private-key-stream.ts` に、runner の既知の秘密の置換と診断ストリーム処理を挙動不変で移す。kit は `maskSecrets`・`createDiagnosticRedactor`・`createPrivateKeyFilter`・`maskValue` を公開する（REQ-447）。
- runner の既存 `mask.ts`・`private-key-stream.ts` を kit からの再エクスポートにし、runner の公開元、既存 import、配布された `dist/mask.js` を維持する。
- `maskValue` は、JSON に使う値と object の省略可能な undefined の範囲を明示して深く複製する。文字列の値と own key を既存の形だけで置換する。循環、キー衝突、対象外の値は、入力値を含まない日本語の UsageError にする。
- REQ-207 の runtime の責務に既知の秘密の置換を明記する。依存の許可・禁止と既存4 Scenario は維持する。
- runtime の固定一覧に、採用仕様の2ファイルだけを追加する。管理役はB01を依存検査を緩めない仕様追従と分類し、追加承認が必要との先の解釈を訂正した。仕様ゲート成功後に実装する。

## Non-goals

### P1 の範囲外だが W1 内で未完了のもの

- P2 の REQ-448〜450：`gh`・`claude`・`codex`・Biome・Playwright の中立変換、kit の共通プロセスによる収集、失敗分類と保存前の置換。
- P3 の REQ-451〜453 と REQ-070 の MODIFIED：既存 verify、trace record、Report API、JSON/Markdown、診断の保護と snapshot/hash の整合。
- P2/P3 の未実装義務と着手前の不足は [parent-handoff.md](parent-handoff.md) に残す。五つのツールを外したり、#65 を P1 で閉じたりしない。

### この依頼の対象外

- #69 の三層保管、保持期間・閲覧権限・削除条件、長期保管先への転送。
- 新 CLI、ツールの導入・認証変更、実 provider/API/LLM の起動、ツール自身のセッション記録の書換え。
- 秘密の形の追加、キー名から秘密を推定する仕組み、環境変数全件や認証ファイルから秘密値を集める仕組み。
- core、verify、trace の製品コードと既存 Evidence 1/2 の変更。core に依存を追加しない。

## Impact

- capability：新設 `secret-redaction`（REQ-447）、`monorepo`（REQ-207 の責務の明記）。
- 製品：kit の2モジュール・公開 export、runner の既存2モジュールの再エクスポート。runner の logs/run/recorder/phases/engine と公開 index は変更しない。
- 試験：新しい kit の要件対応試験。runner と package-artifacts の既存assert・入力・上限は保持し、診断メモリfixtureの読取元だけ共有runtimeへ追従する。`tests/kit-layers.test.ts` はB01の仕様追従として2項目だけを追加し、元の依存規則と全検査を保つ。
- 配布：kit と runner の changeset、kit の共通関数の API 説明。設定、閾値、skip、timeout、依存予算は変えない。
