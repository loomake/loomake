## MODIFIED Requirements

### Requirement: 試験の本文ブロックのハッシュ
試験のハッシュは、選択に一致した各試験の本文ブロック（`it`・`test` の呼び出しの先頭から対応する閉じ括弧まで。`it.each` などの修飾と、引数に直接書いた表を含む）を元の順に連結したもののハッシュとし、`hashScope: "block"` で示す SHALL。本文ブロックは、試験名の文字列リテラル（テンプレート文字列の式と `%s`・`$name` などの置換は任意の文字列とみなす）が実行結果の完全な試験名の末尾に一致するブロックとし、置換と式を除いた固定の文字がない試験名のブロックは照合に使わず、同じ名前のブロックが複数あればすべてを含める SHALL。`hashScope` のない旧形式の対応は、テストファイル全体のハッシュで照合する SHALL。本文ブロックを特定できない試験を確認済みとしない SHALL。

登録済みcompanionの実結果は、raw reportと元sourceの本文ブロック・実行行の多重度を保ち、一意で有効な対応だけを根拠に使う SHALL。

companionは閉じた構文で検査する SHALL。

Source: REQ-347

#### Scenario: 同じファイルの別の試験が変わる
- **WHEN** 本文ブロックのハッシュで記録した対応があり、同じテストファイルの別の試験だけが追加・変更される
- **THEN** 対応は有効のまま残る

#### Scenario: 選んだ試験の本文が変わる
- **WHEN** 本文ブロックのハッシュで記録した対応があり、選んだ試験の本文か、`it.each` の引数に直接書いた表が変わる
- **THEN** 根拠を無効にする

#### Scenario: 本文ブロックを特定できない
- **WHEN** 実行した試験の名前に一致するブロックがないか、ブロックの括弧が閉じていない
- **THEN** 根拠を無効にする

#### Scenario: 登録されたcompanionの成功を元本文と照合する
- **WHEN** 有効な分割一覧に登録された元テストファイルのcompanionが、自身で試験を宣言せず元ファイルだけを読み込み、選択された全試験が成功し、必要なSourceも一致する
- **THEN** 元ファイルの実行結果として元sourceの本文ブロックを元の規則で照合し、記録したハッシュが一致する場合だけ根拠に含める。raw reportと既存レビュー表は変更しない

#### Scenario: 登録外のcompanionの実行結果がある
- **WHEN** 有効な分割一覧に登録されていないcompanionの実行結果がある
- **THEN** その結果を元の実行ファイルのまま扱い、名前から別の元ファイルへの対応を推測しない。この結果だけを理由に登録のエラーにはしない

#### Scenario: 分割一覧または登録されたcompanionが不正である
- **WHEN** 分割一覧がない、読み取れない、不正か、登録されたcompanionが試験を宣言する、元ファイル以外の試験を読み込むなど対応の条件を満たさない
- **THEN** 監査をエラーにし、出力先を作成せず新しい監査成果物を書かない。登録外の結果を自身のファイルとして扱う場合と区別する

#### Scenario: companionの対応で実行行の多重度を保つ
- **WHEN** 異なる入力実行行の完全名が同じであるか、一つの入力実行行が複数の選択条件に一致する
- **THEN** 異なる実行行は同名でもそれぞれ残し、同じ入力実行行は一度だけ数える。各選択条件のハッシュ・成否・必要Sourceの検査は保つ

#### Scenario: 選択した複数本文ブロックの一部が実行されない
- **WHEN** 複数の本文ブロックを選ぶ対応が記録されているが、実行結果にはその一部のブロックに対応する試験しかない
- **THEN** 元の順に選んだ本文ブロック集合のハッシュが記録と一致しない根拠を無効にし、成功を補わない

#### Scenario: companionの試験に失敗または未実行がある
- **WHEN** 登録されたcompanionへ移った選択対象の試験に、失敗・skip・todoが含まれる
- **THEN** 元ファイル側の成功だけでScenarioを確認済みにしない

#### Scenario: 対応の追加だけでは既存の無効や未確認を昇格しない
- **WHEN** companionとの対応が追加されるが、既存のレビュー理由・仕様ハッシュ・試験ハッシュ・必要Sourceや実成功の条件を満たさない根拠がある
- **THEN** 登録の追加だけを理由に確認済みへ変更せず、旧形式のファイル全体ハッシュと移行条件も保つ

#### Scenario: 旧形式の移行でも登録されたcompanionの実行を参照する
- **WHEN** 登録されたcompanionでだけ実行された試験について旧形式の対応を移行する
- **THEN** 元ファイルの実行として既存の移行条件を検査し、実行ファイル名がcompanionであることだけを理由に未実行としない。移行の条件・dry-runの不変性・既存block形式を変更しない

#### Scenario: companionの試験関数の扱いを静的に確かめられない
- **WHEN** 登録されたcompanionが、次の閉じた構文の条件を満たさない。読み込み先を持つImportDeclaration・ExportDeclaration・ImportEqualsDeclarationでは、`vitest`か、`./`または1個以上連続する`../`で始まり、query（`?`）・fragment（`#`）・percent符号（`%`）・バックスラッシュ・空白を含まず、その先の各path要素がASCII英数字・`_`・`-`で始まり残りがASCII英数字・`_`・`-`・`.`だけで、`.js`・`.ts`・`.mjs`・`.mts`・`.cjs`・`.cts`・`.jsx`・`.tsx`の8種のどれかの明示した拡張子で終わり、最終要素に大文字小文字を問わず`.test.`・`.spec.`を含まない相対パスのmoduleだけを認める。既存の元sourceだけをliteralのdynamic importで一度読む条件も保つ。`import.meta`の参照と、calleeがIdentifierの`require`である呼び出しは認めない。vitestのimportはnamespaceか`expect`だけのnamed importに限り、defaultや他の名前は認めない。namespace名とその別名は、import句、`ns.expect`またはliteralの`ns['expect']`、Identifierを束縛する初期化式、全キーがliteralの`expect`でrestのない分割代入の右辺（宣言・代入式）の位置だけに認め、Identifierの別名も同じnamespaceとして追跡する。型の位置は除き、shadowingは区別せず同名を検査する。それ以外の引数・オブジェクトや配列の値・要素の既定値・spread・条件式・return・shorthand・export・非literalキー等の位置でnamespaceを扱うことを認めない。companion本体で値として参照するIdentifierは、同じファイルの字句scopeにあるambientでも型専用でもない変数・引数・binding要素・本文付き関数・class・値importの宣言へ解決できるものだけを認め、宣言のない大域のundefinedだけを例外とする。enum・namespace・ImportEquals・本文のない関数宣言を実行時の束縛とはみなさない。property access、element access、objectまたはbindingの固定keyがconstructor・__proto__・prototypeである場合と、element accessまたはcomputed keyがliteralでない場合は認めない。相対moduleから値としてimportした束縛は、式文そのものである呼び出しの直接のcalleeとしてだけ認める
- **THEN** 監査と旧形式の移行をともにエラーにし、出力先を作らず、raw reportと既存レビュー表をbyte単位で変更しない。既存の拒否検査とimport形の検査を先に適用し、既存の拒否文言を保つ。追加の読込先違反には`companionの読み込み先を静的に確認できません：${companion}`、追加のnamespace位置違反には`companionの試験関数の束縛を静的に確認できません`を使う。既存の試験でない4件の受理と、補助moduleを読む構造・コメント・整形の許容を保つ。依存moduleは次の補助moduleの条件だけを検査し、元sourceから呼ばれる補助関数の本文と実行時の反射を静的検証しないこと、Vitestのglobals無効を前提とすることは既存の静的検査の技術限界として明記する。この限界を既知の不正companionの受理の免除や完成範囲の縮小に使わず、実行時の反射を受入済みの安全な動作と主張しない

#### Scenario: companionが読み込む補助moduleを静的に確かめられない
- **WHEN** 登録されたcompanionから静的import・exportで推移的に読み込む相対moduleが、次の条件を満たさない。リポジトリ内の通常fileでsymlinkでなく実pathがリポジトリ内にある。指定fileと`.js→.ts`・`.mjs→.mts`・`.cjs→.cts`・`.jsx→.tsx`の対応先の1つ以上が存在し、存在する候補はすべて検査する。読み込み先は`vitest`、`node:`の組み込み、第12Scenarioの相対pathの文法だけで、循環は訪問済み集合で止める。構文エラーがなく、トップレベルはimport・export、本文付き関数、型宣言、空文、Identifierの変数宣言、条件を満たすclass、inertな式のexport defaultだけとする。inertはliteral・負の数値literal・Identifier・arrow・関数式・条件を満たすclass式・spreadのない配列・非computedキーとinert値のobject（shorthand・method・getter・setter可）と、その括弧・as・satisfies・非null wrapperであり、評価時のcall・new・tagged・置換template・演算・member・spread・awaitを含めない。classはdecorator・computed名・static初期化・static blockがなく、extendsの式がIdentifierだけとする。companionが呼ぶ名前はmodule内で同名宣言が唯一の、本文付き・非default・非async・非generatorのexport functionで、引数は既定値・分割・restのないIdentifierだけ、本文は同moduleトップレベルのlet・varへ自身の引数かliteralを代入する式文だけとする
- **THEN** 監査と移行をともにエラーにし、出力先を作らず、raw reportと既存レビュー表をbyte単位で変更しない。第12Scenarioの検査を先に適用し、`companionの読み込み先を静的に確認できません：${companion}`を使う。存在しない・読めない・配置が不正な候補も成功へ補わない

#### Scenario: 正規の分割用helperを読むcompanionを受理する
- **WHEN** companionが`tests/helpers/partition-part.ts`のsetPartを式文で呼び、元sourceだけをliteralのdynamic importで読み、補助moduleが第13Scenarioの条件を満たす
- **THEN** 監査と移行で受理し元sourceの本文ブロックで照合する。補助moduleの未呼出の関数本文に組み込みの値・変数key・node組み込みがあることだけでは拒否せず、読んだ補助moduleのhashをinputs.companionDependenciesへ記録する。readModuleを指定しない純粋関数APIでは第12Scenarioまでを適用し、リポジトリの両入口では必ず補助moduleを検査する
