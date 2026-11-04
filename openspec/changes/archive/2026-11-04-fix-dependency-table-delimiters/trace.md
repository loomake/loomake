# Trace: fix-dependency-table-delimiters

## 入力文書
| 文書 | 版 | 日付 |
|---|---|---|
| [#386](https://github.com/loomake/loomake/issues/386)、R3 7e767374/result.md、main #387/#400 | 受入済C1a REQ-400とm1/m2、main7d640808 | 2026-11-04 |
| [本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404)・[整理](https://github.com/loomake/loomake/issues/121#issuecomment-6591563998) | 本文の回答日を根拠に旧trace8/9行だけ訂正 | 2026-11-03 |
| Opus28257774-7008-4251-8d4d-05d980ac5332/result.mdと管理役採否 | actual opus5-5、root CLI25672実0。原記録は旧418WT、監査写しは.loomake/c1-declaration-repair-plan/design-input | 2026-11-04 |

## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-400 | 現主仕様、#386m1、Opus設計§2–3と管理役採否 | 既存の修理 | 短い有効区切りを受け付け、全3kindの値・位置・順序と全既存エラー境界を保持する | 反映済 | specs/verify/spec.md |

## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-DLM-01 | REQ-400 | 区切りセルの形をどう扱うか | A:両端コロン任意・ハイフン1個以上 / B:3個以上 / C:セル内空白許容 | A。既存契約とm1修理を満たす | yes | A。正規表現とMODIFIED400のWHEN2行だけを採用。本文/THEN/旧58は不変 | 管理役（技術判断。利用者の新回答ではない） | 2026-11-04 |

## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

追加仮定なし。Opus原§4のdone自己参照と§5のfullgate2回は管理役が不採用とし、全実作業後の単一標準localdoneを必須follow-upにする。全量165–175行（6文書/同期/archive/chset/日誌込）の見込みを保持し、既存期限・期待・skip・規則/設定は変えない。
利用者直接AGENTSの日別worklog・全日本語yomiyasuを優先する。m2は原回答本文の日付による訂正で、新しい人回答ではない。m3はC1b候補b746608eにerrors優先24例があるが未main。U1/U2・DoD/権限/正のCI・C1b/親#285は今回未完了のまま残す。
