# Trace: verify-dependency-gate-guidance

## 入力文書
| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #285](https://github.com/loomake/loomake/issues/285) | 元6項目とQ境界は受入済み、追加依存検査が残る | 2026-11-03 |
| [依存の質問](https://github.com/loomake/loomake/issues/121#issuecomment-6576621797) | archive存在や依存元の今回の試験を提供元DoDの代わりにしない | 2026-11-02 |
| [本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404) | Q-DEP-01=B/02=C/03=B/04=A | 2026-11-02 |
| Opus設計3380f500 | actual opus5.5、exit0、旧head3b572c22、result.md §3.4/3.5/4.1 | 2026-11-03 |
| 管理役の分割 | C1a REQ-400内部reader、C1b REQ-401 CLI接続。C1a #387固定cf4309ddは未受入 | 2026-11-03 |

## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-401 | Issue #285、本人回答Q-DEP-04=A、Opus設計§4.1判定と不変条件、管理役の分割 | 機能 | 依存宣言の構文をFAIL、未確認をspec-only案内0/done不足1にし、宣言なしと既存判断を保持する | 反映済 | specs/verify/spec.md |

## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

追加の質問はない。本人回答01=Bは同repo Issue CLOSED/COMPLETEDと明示提供元DoD、02=Cは期待Git blobとDoD、03=Bは明示同repo Issue/run/jobだけの読取、04=Aは未取得の案内0/done不足1でUsageError/abortを下げない。
C1bは04の分類と既定の構文接続だけを実装する。01〜03の実取得やDoD照合、必要CI集合U1/他project producer契約U2は後続へ残し、回答済みや実証済みにしない。

## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新しい仮定はない。REQ-401はC1aで予約済み。設計原本はC1a WTの `.loomake/claude/3380f500-70d2-466b-8b7d-a6fafd6a6157/`。本計画baseはmain7d7f69b5。計画段階はC1aを参照だけとし、実装時に固定headを取り込む。
管理役の11/3追加指示で、未受入#387を積んだlocal実装を先行する。比較元はC1a固定headで、mainへの累積差分の間は新PR/独立最終reviewを作らない。C1a受入後に自身差分を確定し、契約変更には追随・再仕様ゲートする。#386の不正行を含むdeclarationsはerrorsを先にFAIL判定する。
