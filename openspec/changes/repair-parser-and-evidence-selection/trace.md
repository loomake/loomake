# Trace: repair-parser-and-evidence-selection

## 入力文書

[Issue #418](https://github.com/loomake/loomake/issues/418)、2026-11-05 の利用者指示。新要件は REQ-422/423 として予約済み。

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-011 | Issue #418 5-2・既存仕様 | 機能 | 表は空行で終える | 反映済 | specs/core-parsers/spec.md |
| REQ-013 | Issue #418 5-1・5-3・5-5・既存仕様 | 機能 | フェンス・BOM・Source を正しく読む | 反映済 | specs/core-parsers/spec.md |
| REQ-051 | Issue #418 5-3・既存仕様 | 機能 | BOM 付き操作を読む | 反映済 | specs/core-parsers/spec.md |
| REQ-018 | Issue #418 5-4・既存仕様 | 機能 | 解析エラーの位置を返す | 既存仕様で充足 | specs/core-parsers/spec.md |
| REQ-202 | Issue #418 REQ-202・既存仕様 | 機能 | 編集で指定外の BOM を保つ | 既存仕様で充足 | specs/core-parsers/spec.md |
| REQ-073 | Issue #418 5-7・既存仕様 | 機能 | SHA の誤診断を直す | 既存仕様で充足 | specs/trace-report/spec.md |
| REQ-422 | Issue #418 5-4・既存仕様 | 機能 | 表内 ID の重複を行番号つきエラーにする | 反映済 | specs/core-parsers/spec.md |
| REQ-423 | Issue #418 5-6・既存仕様 | 機能 | 正規名だけを証拠候補にする | 反映済 | specs/trace-report/spec.md |

| REQ-077 | 既存 core-parsers 規範 | 機能 | 合意の列を保持する | 反映済 | specs/core-parsers/spec.md |
| REQ-078 | 既存 core-parsers 規範 | 機能 | 古い省略列を保持する | 反映済 | specs/core-parsers/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q41801 | REQ-423 | 既存 fixture と期待パスを正規名へ移してよいか | A: 提示した 2 ファイル・24 例だけ移す / B: 保留 | A。壊れた候補の同じ検査を保つ | yes | A。会話で利用者が明示承認。[質問と具体差分](https://github.com/loomake/loomake/issues/418#issuecomment-6647935099)、[管理役の回答記録](https://github.com/loomake/loomake/issues/418#issuecomment-6649006001)。fallback は採用しない | 利用者 | 2026-11-05 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
