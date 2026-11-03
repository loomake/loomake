## Purpose

利用側がテスト本体で明示した範囲の実matcher呼出しと試行の原情報を集め、fixtureやhookと分けた記録をテストのJSONレポートへ残すための契約を定める。

## ADDED Requirements

### Requirement: 明示したテスト本体のmatcher呼出しの記録

システムは@loomake/kitの公開関数createBodyRecorderへ利用側のchaiを渡して得るbody(ctx, fn)により、Vitest 5.0.5のNode環境でraw callback内に明示したfnのtoBe・toEqual・toMatchObject呼出しだけをtask.meta.loomakeBodyへformat:1とattemptsとして記録する SHALL。各試行にはrepeat/retryの原値、expectedFailureの原bool（未定義はnull）、onTestFinished呼出し時点のstateのsnapshotまたはnull、形別callsを記録する SHALL。fixture・hook・閉じた範囲後の呼出しは数えず、失敗catchも呼出しとして数え、入れ子・二重登録を二重計上しない MUST。fnを一度だけ実行し、元の値・例外と非同期完了、テストのstatus/実終了を保つ MUST。記録できない場合は証拠なしまたはstate:nullとする MUST。

Source: REQ-393

#### Scenario: 実matcherの形を記録する
- **WHEN** global/contextの3matcher、not・awaitしたresolves/rejects・soft/poll、空・bare expect・未到達・対象外matcherを明示範囲で実行する
- **THEN** 3matcherの呼出しだけを形別に記録し、その他は0とする。失敗catchも呼出し1回として記録する

#### Scenario: 本体以外を数えない
- **WHEN** fixture・hook・非同期hook・閉じた後のdetachと、concurrentの本体を実行する
- **THEN** 範囲の外は0、各本体の呼出しだけがそのtaskに記録され、未opt-inは証拠を作らない

#### Scenario: 試行の原情報を保つ
- **WHEN** retry・repeat・it.fails・finished hookの失敗・timeoutを含むテストを実行する
- **THEN** 同じtaskの試行ごとの原counter・expectedFailure・観測時点stateを分け、最終結果への反転や後の失敗をsnapshotから保証せず、finished callbackでも範囲を閉じる

#### Scenario: 二重計上と元callbackの変更を防ぐ
- **WHEN** 入れ子・連続呼出し・factory二重作成、戻り値・同期throw・async reject、contextや記録処理の失敗がある
- **THEN** 同一試行をまとめて実呼出しだけを数え、fnを一度だけ実行して元の値/例外を運び、記録失敗を証拠なしまたはstate:nullとする

#### Scenario: 利用側と既存動作を保つ
- **WHEN** kit tarballを直接導入したconsumerで公開入口を使い、同じfixtureを恒等版と取得器版で実行する
- **THEN** 公開APIを解決でき、各fullNameのstatusと各実終了コードが一致する。外部runtime依存・既存API・C001品質観測・CLI main/bin/subpathは変えない
