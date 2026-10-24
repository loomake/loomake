# Trace: clarify-doctor-diagnostics

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-134 | openspec/specs/doctor/spec.mdの既存の診断 | 制約 | 不変更と終了コードを保ち、整った導入にscriptも含める | 反映済 | specs/doctor/spec.md |
| REQ-184 | docs/review.mdのdoctorと使いやすさ、利用者の継続改善指示 | 機能 | 単純な品質scriptの欠落と形を静的に確認する | 反映済 | specs/doctor/spec.md |
| REQ-185 | docs/review.mdの診断範囲と誤案内、利用者の継続改善指示 | 機能 | 未対応の構文と未確認の範囲を表示する | 反映済 | specs/doctor/spec.md |
| REQ-186 | docs/review.mdの実装と入力境界、利用者の継続改善指示 | 制約 | 実行権限と導入パスの種類を確認する | 反映済 | specs/doctor/spec.md |
| REQ-187 | docs/review.mdの未接続の外部操作と資源予算 | 制約 | Gitの期限と異常終了を区別する | 反映済 | specs/doctor/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|

## 参照資料

- pnpm run: https://pnpm.io/cli/run — runとscriptの短縮形、オプションとworkspaceの違い
- Yarn run: https://yarnpkg.com/cli/run — script、依存のバイナリ、workspaceの解決

- npm run-script: https://docs.npmjs.com/cli/v10/commands/npm-run-script/ — scriptの呼び出し、引数とenvの組み込み処理
