## Purpose

同期外部操作を期限と出力予算で監視し、停止後の作業と復旧可能な状態を保つ。

## ADDED Requirements

### Requirement: 期限と出力を監視する外部操作
Git・gh・claudeの存在確認・OpenSpec検証は、1操作あたり既定30秒・stdoutとstderrの合計64MiBを上限とする SHALL。明示された残り時間または共有するrun予算が短ければ短い方を使い、残り時間がなければ起動しない SHALL。制限による停止は対象と理由を含むUsageErrorとして扱い、通常の非ゼロ終了や実行ファイル不存在と区別する SHALL。

Source: REQ-180

#### Scenario: 残り時間を使い切った
- **WHEN** 共有予算を使い切って次の操作を呼ぶ
- **THEN** 操作を開始せず、時間の上限を示す

#### Scenario: 子が終わらないか出力が多すぎる
- **WHEN** 外部操作が期限かstdoutとstderrの合計上限を超える
- **THEN** 理由を区別し、返す出力も予算以内に収めて停止する

### Requirement: 監視対象の子プロセスの停止
期限・出力超過・SIGINT・SIGTERMでは、POSIXは新しいプロセスグループへSIGTERMを送り、250ms後にSIGKILLする SHALL。Windowsではtaskkillによる子孫の停止を試み、taskkill自体も1秒までに制限する SHALL。親コマンドが先に終わっても残ったグループを停止し、出力を握る子孫を無期限に待たない SHALL。監視役は中断を区別する SHALL。プロセスグループから離脱したプロセスの隔離やOS全体の強制上限は保証しない。

Source: REQ-181

#### Scenario: 親が先に終了する
- **WHEN** コマンドの親が終了し、子が出力を開いたまま残る
- **THEN** 監視対象グループを停止し、親の結果を返す

#### Scenario: 監視中に中断する
- **WHEN** 監視役へSIGINTを送る
- **THEN** グループを停止し、中断として返す

### Requirement: runから証拠とPRまでの共有予算
runはロック取得前から実時間の予算を開始し、run.timeoutMinutesの全体予算を準備・Git・OpenSpec・品質コマンド・traceのGit・ghへ共有する SHALL。1操作の既定期限は30秒とし、品質コマンドは既存の残り時間を使う SHALL。共有予算は同時に動く別のrunへ漏らさず、再実行では新しく作る SHALL。開始前の制限エラーは使い方の誤り、記録開始後は停止理由を保存して終了コード1とし、後続のタスク完了・証拠の公開・push・PRへ進まない SHALL。途中で外部操作が完了したか不明な場合は取り消しや成功の推測をせず、既存の再試行の手順を使う SHALL。

Source: REQ-182

#### Scenario: pushが終わらない
- **WHEN** 証拠コミット後のpushで期限に達する
- **THEN** コミットと記録を保ち、PR検索・作成へ進まず終了コード1になる

#### Scenario: 準備中のGitが終わらない
- **WHEN** ロック取得のGitが期限に達する
- **THEN** エンジンと記録を作らず、使い方の誤りとして止まる

### Requirement: verifyとtraceの接続と互換性
verifyのOpenSpec検証とtraceのGitも共通の期限を使う SHALL。品質コマンドの明示した合計予算を維持し、制限による失敗を結果へ記録する SHALL。予算を指定しない単独verifyの品質コマンドは従来の期限なしの動作を維持する SHALL。コマンドの引数・cwd・環境・stdout/stderr・実行ファイル不存在の判定を維持し、依存境界とJSONの版を変えない SHALL。

Source: REQ-183

#### Scenario: OpenSpecの検証が終わらない
- **WHEN** OpenSpec検証が期限を超える
- **THEN** 検証は理由を持つ不合格となり、成功やCLI不存在として扱わない
