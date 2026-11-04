# test-body-evidence Specification

## Purpose

利用側がテスト本体で明示した範囲の実matcher呼出しと試行の原情報を集め、fixtureやhookと分けた記録をテストのJSONレポートへ残すための契約を定める。

## Requirements

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
- **THEN** 公開APIを解決でき、同じhost設定の恒等版と統合版で各fullNameのstatusと実終了コードが一致する。createBodyRecorder(chai)とbody(ctx, fn)の呼出しsignature、統合済みcallbackの挙動、外部runtime依存・C001品質観測・CLI main/bin/subpathを保つ。未設定時の証拠出力は、本仕様の証拠なし・設定移行案内に従う

#### Scenario: 初期化した試行へ初回body前のawaitと並行分岐を帰属させる
- **WHEN** createBodyRunner(Base)を設定した利用側で、初回body前にawaitし、Promise.allの枝・連続body・retry/repeat・concurrentを実行する
- **THEN** 合法なreturn/awaitの証拠を欠落させず、同一試行の分岐を同じattemptへまとめ、別試行を混ぜず、既存attemptsを保持する

システムは公開関数createBodyRunner(Base)で利用側のVitest runnerを拡張し、設定されたrunnerが各試行のcallbackを実行する前に、その実行に属する不透明な識別情報を与える SHALL。bodyはこの識別情報で帰属を決め、変化するtaskのcounterだけから試行を選ばない MUST。統合済みの合法なreturn/await、初回body前のawait、並行分岐・連続・入れ子・retry/repeatでも正しい記録を保つ MUST。

#### Scenario: 終了後の遅い初回と再呼出しを記録しない
- **WHEN** timeoutしたcallbackがretry中または終了後に初めてbodyを呼ぶ、または一度bodyを呼んだcallbackが終了後に再度bodyを呼ぶ
- **THEN** 各fnは一度だけ元どおり実行するが、終了済みの記録は増えず、retryの空bodyへmatcherを足さず、retryがbodyを呼ばない場合も別試行の証拠を作らない

#### Scenario: 未設定の利用側を証拠なしで移行する
- **WHEN** runner統合を設定していない既存の利用側がcreateBodyRecorder(chai)とbody(ctx, fn)を使う
- **THEN** fnの1回実行と元の値・例外・非同期完了を保ち、新しいloomakeBodyを作らない。案内に必要な設定と証拠が欠落する移行影響を示し、設定後は同じbody呼出しから正しい証拠を得られる

runner統合が未設定、または識別情報が欠落・無効・別task・終了済みの場合は、fnを一度だけ実行して元の値・例外・非同期完了を保ち、その呼出しの証拠を新たに作らない MUST。記録準備や計数の失敗でも元のfnを保ち、証拠なしまたはstate:nullとする MUST。設定・移行案内にはrunnerファイルと設定の導入方法、既存runnerの合成、未設定の旧利用側が証拠を出さなくなる影響を明記する SHALL。旧記録へ未検証flagを加える別形式は導入しない MUST。

#### Scenario: モジュール分離と再構成contextから試行を読む
- **WHEN** 既定のisolateでrunnerとテストのkitが別に評価され、{task, onTestFinished}として再構成したcontext、複数ファイル・再実行・factory二重作成からbodyを呼ぶ
- **THEN** 元の試行を読み、同じ試行を二重記録せず、ファイルやtaskをまたいで混ぜない。isolate:falseでも同じ契約を保つ

#### Scenario: 既存Baseと元のfixture時間境界を保つ
- **WHEN** 標準Baseまたは既存runTask・extendTaskContextを持つBaseを渡し、自動fixtureと利用側aroundEachを含む同じhost設定で恒等版と統合版を比較する
- **THEN** Baseの実行を一度だけ委譲し、同じhost設定の各fullName/statusと実終了コードを保つ。custom Baseの後処理中の遅い初回bodyは同じ元試行へ帰属させ、委譲終了後や次retryでは元の閉じた識別情報で加算を防ぐ。元のfixture/timeout境界を変えず、既存runnerを黙って置換しない

試行の記録範囲は、標準Baseでは公開getTestFnで得た元のcallback wrapper、既存runTaskを持つBaseでは一度だけ委譲したBase.runTaskが完了・失敗でsettleした時点と、finished callbackの早い方で閉じる MUST。標準Baseのtimeoutは元wrapperのsettlementとして扱い、custom Baseの後処理中は同じ元試行の識別情報と原counterを保つ MUST。閉じた試行から遅れて初めてbodyを呼ぶ場合も再度呼ぶ場合もfnは実行するが、記録の作成・再開・加算・別試行への転記をしない MUST。finishedでは試行の記録と全計数範囲を閉じ、同じtaskの各試行はattemptsへ一度ずつ追加して先の履歴を消さない MUST。

#### Scenario: snapshot読取と記録の失敗時にも閉鎖する
- **WHEN** finishedでstateの読取が失敗するか、context・reader・metadata・計数の操作に失敗する
- **THEN** 元のcallback動作を保ち、記録不能は証拠なしまたはstate:nullとし、finishedで試行の記録と全計数範囲を必ず閉じて後の加算を防ぐ
