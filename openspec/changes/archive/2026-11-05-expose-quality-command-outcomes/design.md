# Design

## Context

動機は proposal.md に示す。補足設計 4d721b5d の §4.1 を独立した前提へ分ける。生の spawn 結果は runCommands 内にだけ存在し、現在の VerifyResult から終了の完全性を復元できない。期限がない `runExternal(qualityCommand:true)` は Infinity の検証で例外になるため、C2 に実行順序・予算・spawnSync 分岐を複製しない。

## Goals / Non-Goals

既存の一つの実行経路を使い、下流へ終わり方を通知する。通知は shell の直接の実行経路で観測した事実であり、テスト全件の完了証明ではない。C2 のレポート完全性と receipt は別の仕様・実装とする。

## Decisions

### 公開型と通知箇所

`packages/kit/src/verify/run.ts` に次の型と任意オプションを追加し、`packages/kit/src/index.ts` から型を export する。

```ts
export type QualityCommandOutcome = { name: string } & (
  | { kind: 'exited'; status: number }
  | { kind: 'signal'; signal: NodeJS.Signals }
  | { kind: 'error'; code: string | null }
  | { kind: 'timeout' | 'interrupted' | 'output'; reason?: string }
);
// VerifyOptions
onCommand?: (outcome: QualityCommandOutcome) => void;
```

runVerify の二つの runCommands 呼出にだけ通知先を渡す。品質コマンドの順序・skip・deadline・holderWaitTime・hasProcessBudget・spawnSync/runExternal の選択・record/fail/failed を保持する。追加の外部実行はしない。通知順は次のとおりで、各通知は新しいオブジェクトとする。

| 実行経路 | 通知 | 境界 |
|---|---|---|
| 訪問時 left<=0 | timeout | 起動しないが既存の失敗対象として訪問済み |
| 実行の ProcessLimitError | 元の kind と存在する reason | timeout/interrupted/output |
| r.error | error と string code、なければ null | status より error を優先 |
| status:null、signal あり | signal と元の信号名 | signal:null を信号名として偽装しない |
| status:null、signal なし | error・code:null | 終了情報の欠落 |
| 数値 status | exited と元の status | 非0も正常な数値終了として通知 |

skip・空コマンド・仕様ゲート・既存の早期 return 後の未訪問コマンドと、OpenSpec 検査等の外部操作には通知しない。上限例外に対する既存の fail/failed/return を保持し、通知のための再実行はしない。

### 通知先の例外と変更

既存 progress は実行用 try/catch の前に呼ばれ、その例外はそのまま API 呼出元へ伝わる。同じ契約を onCommand に適用する。通知は実行用 try/catch の外側で呼び、通知先が投げた ProcessLimitError を品質コマンドの失敗と誤認しない。上限例外をいったん実行結果として捕捉してから、catch の外で通知と既存処理を行う。握り潰す新しい catch は作らない。

元の spawn 結果を通知先へ渡さない。数値・文字列のコピーだけでイベントを作り、通知オブジェクトの変更が record/failed の入力や次の通知へ伝わらないようにする。戻り値を使わず、非同期通知・完了待ちの契約は追加しない。

### 試験と公開説明

kit の新規試験は、隔離した一時プロジェクトで spawnSync/runExternal の結果だけを差し替え、通知のない既存入力との戻り値・JSON・verifyExitCode を全体比較する。通常失敗、signal、error(code あり/なし)、終了情報欠落、ProcessLimitError 3種、期限切れ、skip、空、途中 return、change 付き done と spec-only を検証する。通知先が通常 Error と ProcessLimitError を投げたときの同一オブジェクト伝播・後続未起動、通知変更の隔離も確かめる。public-api consumer fixture は既存利用を残して新型を使い、kit minor changeset と API 説明を同じタスクで追加する。

## Risks / Trade-offs

- shell は command-not-found や孫への signal を数値終了へまとめることがある。通知はそれを推測で書き換えず、C2 がレポートと照合する。
- P1 の Vitest 5.0.5 では通常失敗と bail=1 を区別できたが、ラッパーで両方 exit0 になる。全 hidden bail 排除の証明ではなく、この API の通知だけで receipt を作らない。
- 79b4d2aa §3.5 手順8〜9の「既存 VerifyResult だけから完了判断」は4d721b5dと管理役決定で失効した。台帳・FIFO・履歴の設計は変更しない。4d721b5d の「0なら bail なし」も採用しない。

## Migration Plan

任意型の追加だけなので既存利用の移行は不要。通常 L3 の完了・CI・独立レビュー後に main 同期と archive を行い、その受入済み API を C2 が使用する。C2 親の要件・Scenario・未実装タスクを削除しない。
