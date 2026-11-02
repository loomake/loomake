# Trace: trusted-trace-decision-row

## 入力と出典
[Issue310](https://github.com/loomake/loomake/issues/310)、archive reader設計§3・Q-S1-11、新Opus最小5a設計af2924dd-195b-4011-95c0-9469ac15c942（2026-11-02、claude-opus-5-5、ok:true）。[REQ390予約](https://github.com/loomake/loomake/issues/310#issuecomment-6570501505)。管理役が最小parsedモデル部品への分割を選び、新受入条件の採用とはしていない。

## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-390 | C3最小5a、新Opus§1〜3 | 機能 | モデル内のID一意・回答/承認非空を照合し、既知セルを防御的に返す。常時false、空/空白IDを拒否 | 反映済 | specs/trusted-baseline/spec.md |

## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-ROW-01 | REQ-390 | parseTraceはID空の行も残す。照合IDが空文字・空白だけならどう扱うか。検証済み非空採否参照だけを入力域とする規範も未確定 | A: 空/空白IDを拒否 / B: 完全一致を適用 / C: 既存契約の非空参照だけを対象にする | Aを推奨。元shapeのtrim非空と揃い、IDなしを採否にしない。ただしREQ377/採用designはid自体の明文・直接試験が不足。Cも根拠確認後に確定し、親/S1の義務は減らさない | yes | A。空文字・空白だけのIDを拒否する。[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6590095928) | 利用者（rrr-www、Claude Opus 5.5が転記） | 2026-11-02 |

## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

全7 Scenarioを新規T-ROW-01〜06/08へ順に対応させる計画。子4/5b/6/7、文書来歴・API・本人承認・S1/親、Q-C3-01/02は同じ本人回答でA（拒否）に確定したが、その親実装・D38の個別採否は未完了。REQ379/380/388/389は保持する。
