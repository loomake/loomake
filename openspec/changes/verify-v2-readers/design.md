# Design: verify-v2-readers

## Context

2本目を2つのPRに分けた前半。verify・trace recordの書き出しは1.0.0とEvidence 1のままにして、読む側だけを先に2.0.0とEvidence 2へ対応させる。後半 `verify-v2-wiring` で書き出しを切り替えるとき、読む側の差分を小さくする。

## Decisions

### 1. 版の見分け

kitの `isVerifyResultV2` は `schemaVersion` が `2.0.0` かで見分ける。runnerとPR本文は、1.0.0ならこれまでの処理、2.0.0なら新しい処理を通す。`runVerify` の戻り値の型は1.0.0のままなので、2.0.0を受け取る関数の引数は `VerifyResult | VerifyResultV2` にする。

### 2. runner

- `decideAfterGate` の観測に `aborted`（実行エラーの説明）と `decisionReasons`（要判断の理由）を任意の欄として足す。判断の順は、状態の変更、aborted、要判断、完了、中断、期限、修正回数。既存の観測（新しい欄なし）の結果は変わらない
- `gateObservation` は、1.0.0では `ok` をそのまま使い、2.0.0ではscope:localで終了コード0の結果だけを完了とする（仮定A-01）
- 仕様ゲートは `specGateOutcome` で終了コードを決める。2.0.0のabortedは2・3を返し、ブランチを作らない。例外のときは、切り替えたブランチを戻してからCLIに渡す
- `RunSummary.lastVerify` は `{ ok, mode }` の外形を保つ。2.0.0ではokをlocalの完了、modeを `done` にする
- 証拠の再利用は、Evidence 1はこれまでどおり、Evidence 2はscope:localの完了で不合格や不足の検査がないものだけにする

### 3. trace

`evidenceProblem` は、Evidence 1にはverify 1.0.0、Evidence 2にはverify 2.0.0を求め、混在を拒否する。2.0.0は実行状態とscopeごとの必須欄と禁止欄を確かめる。reportは `evidenceProblem` を通った記録を `projectEvidence` で読むので、正しいEvidence 2を読める。未対応の版の文言（REQ-073）は変えない。

### 4. ci-gate

`ciGateProblem(stdout, exitCode)` を足す。2.0.0はci・completed・要判断なし・verdict PASS・不合格や不足の検査なし・終了コード0だけを受け入れ、1.0.0はok:true・failなし・終了コード0を受け入れる。実行の流れ（終了コードで判断する）は変えない。流れへのつなぎ込みと1.0.0を受け入れなくする変更は `verify-v2-wiring` で行う。

## Risks / Trade-offs

- 2.0.0を返す `runVerify` はまだないので、runnerの試験は `runVerify` をモックして2.0.0を与える
- reportは、Evidence 2のすべての不正（版が2で埋め込みのverifyが1.0.0の記録や、状態別の必須欄が欠けた記録など）に、これまでどおり「読めるのは 1」と表示する。壊れたEvidence 2の不正箇所を示す修正はREQ-073として後半で行う
