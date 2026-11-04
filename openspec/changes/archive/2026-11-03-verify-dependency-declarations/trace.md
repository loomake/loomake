# Trace: verify-dependency-declarations

## 入力文書
| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #285](https://github.com/loomake/loomake/issues/285) | 元6項目は#299/#335、ID境界は#327/#364で受入。全3種依存検査が残る | 2026-11-03 |
| [依存の質問](https://github.com/loomake/loomake/issues/121#issuecomment-6576621797) | archive存在・依存元の今回の試験だけでは提供元DoDにならない | 2026-11-02 |
| [本人の回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404) | Q-DEP-01=B、02=C、03=B、04=A | 2026-11-03 |
| [完了条件の整理](https://github.com/loomake/loomake/issues/121#issuecomment-6591563998) | 自身の完了条件・mainの試験・必須CI。条件外のSHA/blob/byte証明を足さない | 2026-11-03 |
| Opus設計3380f500 | `.loomake/claude/3380f500-70d2-466b-8b7d-a6fafd6a6157/result.md` §4.1。actual opus5.5、exit0、旧head3b572c22 | 2026-11-03 |
| 今回の分割判断 | readerの全3種構文REQ-400をC1a、CLI接続REQ-401をC1bに分離。計画だけのPRは作らない | 2026-11-03 |

## 要件台帳
| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-400 | Issue #285追加3種、本人回答、Opus設計§4.1の宣言の形、今回の分割判断 | 機能 | 全3種の任意依存表を内部で構文検証し、行と値とエラーを返す。外部操作・公開形変更なし | 反映済 | specs/verify/spec.md |

## 確認事項
| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

追加の質問はない。Q-DEP-01=Bは同repo Issue CLOSED/COMPLETEDと明示提供元DoD、02=Cは期待Git blobとDoD、03=Bは明示同repo Issue/run/jobだけの読取、04=Aは未取得の案内0/done不足1で、既存UsageError/abortを下げない。これらの実在確認・判定は後続であり、C1aの成功条件には加えない。

## 仮定
| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新しい仮定はない。U1/U2は後続の未決事項としてdesignに保持し、回答済みとしない。
REQ-400/401は全153登録WTのactive文書11479件とGitHubIssue検索で未使用を確認。REQ-401はC1b用予約であり、本changeの要件・実装完了には数えない。
pathの `..` は親参照の区間を指し、通常名 `a..b.ts` は受け付ける。`trusted/canonical.ts:isSafeRepoPath` と `init/init.ts:unsafeTarget` の既存境界を根拠に管理役が採用した技術判断であり、利用者の新回答ではない。trusted固有の追加制限は採らず、Opus原文は保持する。
