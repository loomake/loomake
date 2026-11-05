# Trace: fix-literal-git-paths

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #414](https://github.com/loomake/loomake/issues/414) | 目的・根拠・直し方・足すテスト | 2026-11-05 |
| 利用者の delivery 指示 | 6 Issue の実装順・同時上限・共通検証 | 2026-11-05 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-109 | Issue #414「関係する spec」「足すテスト」、現行 run-guards の検出規範 | 機能 | pathspec の名前でも skip と既存アサーションの削除を検出して止まり、対象の差分を出す | 反映済 | specs/run-guards/spec.md |
| REQ-138 | Issue #414「直し方」「足すテスト」、現行 run-guards の特殊文字パス | 制約 | ファイル名を pathspec の式にせず扱い、既存の特殊文字パスの検出も保つ | 反映済 | specs/run-guards/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

| Q-414-01 | REQ-109・REQ-138 | Git 2.56.0 の check-ignore は literal=1 を拒否する。git 環境の固定と check-ignore だけの互換処理を採用するか | A: 通常経路は literal=1 と他の pathspec 環境 3 種を 0、check-ignore だけ literal=0 と先頭コロンへの ./ 接頭辞 / B: 保留して別案を検討 | A。元の環境を変更せず、実ファイル名の判定と既存の除外判定を両立できる。30 ケースで比較済み | yes | A を承認。通常経路は literal=1、他の pathspec 環境 3 種は 0。check-ignore だけ literal=0、先頭コロンへ ./ を付ける。[提示差分](https://github.com/loomake/loomake/issues/414#issuecomment-6647986907) | 利用者（今回の回答） | 2026-11-05 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

Issue の明記した設計を再利用し、既存の動作を満たす回帰 Scenario で確かめる。git の glob に依存する呼び出しは見つからなかった。新しい製品要件と未承認の仮定はない。check-ignore の互換処理は Q-414-01 で利用者の承認を得た。
