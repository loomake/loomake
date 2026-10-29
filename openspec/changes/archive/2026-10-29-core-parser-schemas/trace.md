# Trace: core-parser-schemas

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #60](https://github.com/loomake/loomake/issues/60) の作業・完了条件 | W1-1 | 2026-10-29 |
| [Issue #60 の Q-03 決定](https://github.com/loomake/loomake/issues/60#issuecomment-6480846573) | 決定済み | 2026-10-29 |
| openspec/changes/core-zod-verify-result/trace.md の REQ-277・Q-03・A-03 | 先行 change | 2026-10-29 |
| docs/architecture.md の 0.2・5 章・付録 A、docs/requirements/loomake-v0.11.md の 7.3 | v2.5.5・v0.11.3 | 2026-10-29 |
| 管理役の割り当て：parser の型・版定数・JSON 生成だけを移行し、既存データと同期 API を維持する。公開初版 1.0.0、遅延ロード、JSON 独自 annotation なしに合意 | 本体セッション | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-298 | Issue #60 作業・完了条件、先行 REQ-277、アーキテクチャ 0.2、要件定義 7.3 | 機能 | trace・spec・tasks の公開型を Zod から導出する。外部の形と同期パーサの意味検証を維持し、スキーマは未知フィールドを許す | 反映済 | specs/core-parsers/spec.md |
| REQ-299 | Issue #60 Q-03 決定、先行 A-03、管理役の技術方針の合意 | 機能 | 3 形式のスキーマバージョンを core の定数として公開し初版は各 1.0.0 とする。Markdown と返却データを変えず、スキーマを遅延ロードする | 反映済 | specs/core-parsers/spec.md |
| REQ-300 | Issue #60 完了条件、アーキテクチャ 5 章・付録 A、管理役の技術方針の合意 | 非機能 | Zod から 3 形式の JSON Schema を書き出して配布し、CI で生成差分を検出する。独自のバージョン annotation は加えない | 反映済 | specs/core-parsers/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-03 | REQ-299 | Markdown に版を書く場所がない。trace・spec・tasks のスキーマの版をどこに持つか | A: core の定数 / B: 冒頭コメント / C: trace.md だけ | A。OpenSpec の書式を変えずに済む | yes | A。core の解析結果スキーマの定数として持ち、Markdown に書かない。[決定記録](https://github.com/loomake/loomake/issues/60#issuecomment-6480846573) | リポジトリの持ち主（決定コメント） | 2026-10-29 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
