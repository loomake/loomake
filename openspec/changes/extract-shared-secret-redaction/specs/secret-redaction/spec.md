# secret-redaction Specification

## Purpose

kit と runner が既知の秘密の形を同じ規則で置き換えるための公開関数を定める。既存 runner の文字列・診断ストリーム・配布元の互換性と、構造化した値を入力不変で複製する際の受理範囲、拒否、安全な own key の扱いを明確にする。

## ADDED Requirements

### Requirement: kit の共通の秘密置換と runner の互換性

`@loomake/kit` は maskSecrets・createDiagnosticRedactor・createPrivateKeyFilter・maskValue を named export し、REQ-118/199 の既知の形だけを置換する SHALL。runner の公開元・既存 import・配布物と依存の契約を維持する MUST。maskValue は下の Scenario で定める JSON データと object の optional undefined だけを受理し、入力不変の深い複製と安全な own key を返す SHALL。対象外入力・循環・置換後 key 衝突は、入力内容を含まない UsageError にする MUST。getter/toJSON を実行せず、全関数で I/O・外部実行・通信・環境・時計を使わない MUST。

Source: REQ-447

#### Scenario: 既存のプレーン文字列の置換を共有する
- **WHEN** 既知の形、Bearer、秘密鍵、JSON の Unicode escape、escaped newline、途中で切れた JSON と、置換対象でない通常の文を kit と runner の maskSecrets に渡す
- **THEN** 両公開元は同じ関数であり、既存の置換結果と JSON の構文、Bearer の語、通常の文を維持する
- **AND** `@loomake/kit` は named export として `maskSecrets`・`createDiagnosticRedactor`・`createPrivateKeyFilter`・`maskValue` を提供する SHALL。文字列と診断ストリームの3関数は、REQ-118・REQ-199 の既存の既知の形だけを `***` に置き換え、Bearer の語、JSON 文字列・途中出力・チャンク境界・秘密鍵・保留量の扱いを維持する MUST。任意のパスワードや個人情報を検出できると保証せず、キー名による推定や明示された秘密値の収集は加えない MUST。処理は I/O・外部コマンド・通信・環境・時計を使わない MUST。

#### Scenario: 診断ストリームと秘密鍵フィルターを共有する
- **WHEN** 既知の形と秘密鍵をチャンクの境界で分け、途中の終端と長い未確定部分も含めて kit と runner の診断ストリーム・秘密鍵フィルターへ渡す
- **THEN** 両公開元は同じ関数を返し、既存と同じ出力・保留量・終端処理となる

#### Scenario: JSON のプリミティブと空の値を保つ
- **WHEN** null・true・false・有限の number・負の0・空文字列・空のArray・空のobjectをmaskValueへ渡す
- **THEN** 値の種類と内容を維持し、Arrayとobjectは入力とは別の複製で返る
- **AND** `maskValue<T>(value: T): T` は次の入力だけを受理し、文字列の値と object の own key に `maskSecrets` を適用した深い複製を返す SHALL。入力、共有プロトタイプ、入力内の別の参照先を変更しない MUST。ここで T は既存の結果型を受け渡すための型であり、秘密を含む文字列リテラルやキー名がそのまま返る保証ではない。 値は null、boolean、有限の number、string、dense な通常の Array、および prototype が `Object.prototype` または null の通常の object とする。number は `-0` を含めて値を維持する SHALL。

#### Scenario: 入れ子と optional undefined を入力を変えずに複製する
- **WHEN** 既知の秘密の形の文字列を含む dense Array と plain object、および欠落した optional field と own enumerable な undefined の field を組み合わせて渡す
- **THEN** 値と key の文字列だけが置換され、入力は不変で、全Array/objectは新しい参照になり、欠落とown undefinedは区別されたまま保たれる
- **AND** object は own enumerable string key の data property だけを扱い、その値としての undefined は own property の有無と値を保つ SHALL。optional field の欠落を補わず、null と undefined を変換しない MUST。key の順序は置換前の own enumerable key の列挙順を基にし、通常の JavaScript の key 列挙規則に従う SHALL。

#### Scenario: JSON データの範囲外を拒否する
- **WHEN** root/Array要素のundefined、非有限number、bigint、function、symbol、class instance、Date、Map、Set、Proxyのいずれかをrootまたは入れ子の値へ置く
- **THEN** 対象外の値をnull化・省略・文字列化せずUsageErrorにし、例外のmessageとcauseに入力値を含めない

#### Scenario: getter や toJSON を実行しない
- **WHEN** getter、setter、toJSONメソッド、symbol key、non-enumerableなobject propertyを持つ値を渡す
- **THEN** getterとtoJSONは一度も実行されずUsageErrorとなり、入力と共有プロトタイプは変わらない

#### Scenario: Array の穴と追加 property を拒否する
- **WHEN** 穴のあるArray、非enumerableな要素、accessorの要素、length以外の追加string keyまたはsymbol keyを持つArrayを渡す
- **THEN** 穴をnullへ変えたり追加propertyを捨てたりせずUsageErrorとなる
- **AND** Array は prototype が `Array.prototype` で、0から length−1 まで own enumerable な data property を持ち、length 以外の余分な own property を持たないものに限る。要素数と順序を保つ SHALL。 root の undefined、Array 要素の undefined、NaN・正負の Infinity、bigint・function・symbol、Array の穴、対象外の prototype や class instance、Proxy、accessor、symbol key、object の non-enumerable property、Array の余分な own property は UsageError として拒否する SHALL。getter と `toJSON` を実行しない MUST。

#### Scenario: prototype に見える own key を安全に扱う
- **WHEN** own __proto__・constructor・prototypeと、その値に置換対象の文字列を持つ通常objectまたはnull prototypeのobjectを渡す
- **THEN** 各keyはown propertyとして残り、値は複製・置換され、入力と出力のprototypeはそれぞれ元の種類で保たれ、共有prototypeは変更されない
- **AND** own `__proto__`・`constructor`・`prototype` は通常の文字列 key として安全に定義し、その値も複製・置換する SHALL。own `__proto__` を出力や共有プロトタイプの変更として解釈しない MUST。入力が null prototype なら複製も null prototype とし、通常 object と Array の prototype もそれぞれ維持する SHALL。property の writable/configurable 属性や freeze 状態の再現は要求せず、複製の data property は通常の enumerable property とする。

#### Scenario: 循環ではない共有参照を複製する
- **WHEN** 同じobjectまたはArrayを2箇所から参照するが祖先へ戻らない値を渡す
- **THEN** 処理は成功し、2箇所の出力は元の参照とも互いとも異なる複製となる

#### Scenario: 循環を拒否する
- **WHEN** objectの自己参照、Arrayの自己参照、objectとArrayの相互参照のいずれかを渡す
- **THEN** 部分的な複製や無限処理で返さず、入力内容を含まないUsageErrorとなる

#### Scenario: 置換後の key の衝突を拒否する
- **WHEN** 同じobjectの異なるkeyがmaskSecretsで同じkeyになる値を渡す
- **THEN** UsageErrorとなり、入力は変わらず、どちらの値も上書きして返さず、例外のmessageとcauseに元のkeyや値を含めない
- **AND** 同じ object/Array を複数箇所から参照していても、祖先へ戻る循環がなければ受理し、出現ごとに独立した複製を返す SHALL。循環と、同じ object 内で異なる key が置換後に一致する場合は UsageError にし、一方の値を上書き・破棄してはならない MUST。UsageError の message と cause に入力値・キー・部分的な複製を含めない MUST。

#### Scenario: 配布後も既存の公開元を維持する
- **WHEN** kitとrunnerをbuild/packし、既存のrunner公開export・直接module import・dist/mask.jsの診断ストリームを使う
- **THEN** 新たなruntime依存やconsumer設定なしに既存と同じ関数が利用でき、既存のrunner試験とpackage-artifacts試験が無変更で成功する
- **AND** runner の `mask.ts` と `private-key-stream.ts` は kit から再エクスポートし、runner の既存の公開元・直接 import・配布後の `dist/mask.js` から同じ関数と同じ結果が得られる SHALL。kit・runner の実行時依存を増やさず、core を変更しない MUST。
