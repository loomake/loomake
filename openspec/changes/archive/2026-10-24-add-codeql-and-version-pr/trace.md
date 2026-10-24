# Trace: add-codeql-and-version-pr

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-167 | harden-release-workflow の REQ-167、確認事項 Q-01 の回答 | 非機能 | サブパスつきの Action の参照も SHA で固定し、リポジトリと SHA で照合する（変更） | 反映済 | specs/release-integrity/spec.md |
| REQ-200 | 2026-10-24 の品質評価のセキュリティの指摘、確認事項 Q-01 の回答 | 非機能 | CodeQL で JavaScript・TypeScript を解析する | 反映済 | specs/release-integrity/spec.md |
| REQ-056 | mvp の REQ-056、確認事項 Q-02 の回答 | 非機能 | 版を上げるだけの PR では changeset status の失敗を許す（変更） | 反映済 | specs/monorepo/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-01 | REQ-167・REQ-200 | CodeQL を足すために、REQ-167 の検査をサブパスつきの参照も認める形にしてよいか | 進める / 進めない | 進める | yes | おすすめどおり進める（利用者、2026-10-24） |
| Q-02 | REQ-056 | 版を上げる PR を通すために、REQ-056 の検査に例外を足してよいか | 進める / 進めない | 進める | yes | おすすめどおり進める（利用者、2026-10-24） |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-200 | CodeQL の Action の記録は、既存と同じく ref v4 のコミットを使う | 既存の記録の形（v4 系）にそろえるため | |
