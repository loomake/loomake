# Tasks

## 1. 計画と実装開始の依存

- [x] 1.1 出典つきproposal・specs・design・traceを揃え、yomiyasu・OpenSpec strict・`pnpm -s verify --change add-cli-reference-generation --spec-only`の成功を記録する
- [x] 1.2 quality生成の受入・完了ゲート・全tasks完了とreference-docsの主仕様反映を確認してから最新mainへ追従し、Purpose・REQ-320〜322を保った計画と仕様ゲートの成功を再確認する。依存が揃うまで2.1へ進まない

## 2. CLI定義とリファレンス

- [ ] 2.1 基準mainのhelp/usage全文fixtureを固定し、args.tsの共通記述へmain/help/候補を接続する。REQ-323/324の全コマンド・オプション・条件・既定値・構文・候補順・診断優先の新規回帰と、既存args/help/usage/trace-agreement/遅延起動試験を通し、説明を共通記述へ揃える
- [ ] 2.2 CLI専用renderer・生成/checkと5.cli.mdを実装し、REQ-323/325の全列挙・特殊文字・決定性・一致・欠落・改変・LF/CRLF・read/render失敗・check非変更を試験する。生成元・再生成方法・title/descriptionをページに持たせ、ソース定義との一致が既存CIのテスト経路で検査されることを確認する
- [ ] 2.3 quality側の既存ページ・Purpose・要件を保ってguide入口と開発手順へCLI分を追記し、loomakeのpatch changesetを追加する。doc-links、生成/check、配布物からの生成入口とhelp/引数の互換を確認する。quality生成器・共通helperを変更しない

## 3. 統合確認

- [ ] 3.1 lint・型検査・関連試験・全体完了ゲートを通し、REQ-323〜325のID付き試験と独立レビュー、最終headの`pnpm -s verify --change add-cli-reference-generation --done`合格を確認する <!-- loomake:gate=done -->

## Workflow follow-up

- 最終headのCIを確認し、qualityとCLIの両範囲の受入根拠をIssue #104へ記録して完了判断する。
- 受入後に差分仕様を反映してarchiveする。先行qualityのPurpose・REQ-320〜322を維持する。
