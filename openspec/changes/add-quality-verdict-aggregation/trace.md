# Trace: add-quality-verdict-aggregation

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md 7.3 集約の規則・品質判定の4値 | v0.11.3、main 47b31f2 | 2026-10-29 |
| docs/wbs/baseline-v1.4.md 5章 C-001、W1-4 | v1.4、main 47b31f2 | 2026-10-29 |
| [Issue #63](https://github.com/loomake/loomake/issues/63) の先行範囲と担当記録 | 管理役が本会話の仕様案を承認し Issue に記録 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-305 | 要件定義7.3の品質判定4値、WBS C-001、Issue63先行合意 | 機能 | core に共有4値の Zod enum と導出型・遅延 loader を置き、既存 verify と8本の JSON を保持する | 反映済 | specs/core-parsers/spec.md |
| REQ-306 | 要件定義7.3「集約の規則」、WBS C-001の条件と集約先行、Issue63先行合意 | 機能 | 評価済み4値から FAIL・証跡不足・PASS の順に CI verdict だけを純関数で集約し、空と全件対象外を証跡不足にする | 反映済 | specs/verification-policy/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

本範囲の未決事項はない。summary.evaluated の意味は未確定だが、件数や summary を返さない今回の集約には影響しないため対象外とする。quality ファイル不在・bare verify・source/metric の接続判断も対象外とし、後続の実装で確認する。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

仮定は置かない。分割と API の範囲は、2026-10-29 の本会話で管理役が承認し Issue #63 に記録した。
