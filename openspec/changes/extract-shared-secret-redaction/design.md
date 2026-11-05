# P1 共通の秘密置換

## 設計と採用範囲

設計元は Opus の `7e9d5568-6df5-4ee8-9b3c-aaf939953f20`（実モデル claude-opus-5-5、design、exit 0、Read/Glob/Grep、対象 head b2b9f3977f914062b989c8177efcdb2037842536）。原本は `.loomake/claude/7e9d5568-6df5-4ee8-9b3c-aaf939953f20/result.md` と manifest にあり、管理役が成果物を確認した。

管理役は2026-11-05に P1→P2、P1→P3 の3本の通常L3分割、REQ-447〜453の予約、Q65-03/04のAを採用した。各PRで通常の完了条件を満たし、段階受入や部分的なゲート成功を使わない。対象headのAGENTS.mdとpackage.jsonでは、coreに既存のzod ^4.6.7、kitに既存のyaml ^2.9.1がある。P1はcoreを変更せず、kit/runnerを含め外部の実行時依存を増減しない。P2のconverterも純粋な処理とし、外部依存を新たに利用しない。この作業では既存依存の整理や、旧AGENTSとの相違の解消は行わない。

別セッションの旧設計 `mask-collected-evidence` は採用しない。そこにあった「五つのツールを作らない」「P1で#65を閉じる」「documents/古い証拠の秘密をすべて対象外にする」という縮小案は今回の契約ではない。後続の全義務は parent-handoff.md に保持する。

## モジュールと公開元

- 新しい `packages/kit/src/runtime/redact.ts` は runner の mask.ts の既存本文と、新しいmaskValueを持つ。既知pattern、Bearer、JSONのUnicode escapeと途中出力、streamの保留量と終端処理は変えない。
- 新しい `packages/kit/src/runtime/private-key-stream.ts` は既存の秘密鍵filterの本文を挙動不変で持つ。redact.tsから同じruntime内の相対importを使う。
- kit/index.tsから4関数をnamed exportする。privateなprototype判定・入力検証・複製のhelperは公開しない。
- runner/mask.tsはkitからmaskSecrets/createDiagnosticRedactorを再exportし、runner/private-key-stream.tsはcreatePrivateKeyFilterを再exportする。runner/index.tsのmaskSecretsの既存export、runnerの直接呼出元、既存試験の全assert・入力・上限、pack後のdist/mask.jsは維持する。
- 外部library、SDK、新しいprocess実装、環境参照は加えない。Node標準の純粋な型判定を使う場合もI/Oは行わない。

## Q65-10：JSONに使う値の境界

公開署名は `maskValue<T>(value: T): T` とする。既存のVerify/Evidence/Reportの型はloose unknown fieldを持ち、Verifyのcoverage等はoptionalである。strict JSONの再帰型だけを引数制約にすると既存型をそのまま渡せず、objectのown undefinedまで捨てる前処理は未知値保持の契約を変え得る。このため管理役はA「通常のJSONデータと、objectのown optional undefinedを保持」を採用した。

null/boolean/finite number/string、通常のdense Array、Object.prototype/null prototypeの通常objectを受け付ける。rootとArray要素のundefined、非finite、非plain、accessor、symbol key、non-enumerableなobject property、配列穴/余分なpropertyは拒否する。Proxyは通常objectではなく対象外として拒否する。getter/toJSONを実行しないため、値を読む前にown descriptorを確認する。Proxyはdescriptor列挙の前に判定し、そのtrapを処理の手段として使わない。

Proxyの拒否にはNode標準の `import { types } from 'node:util'` と `types.isProxy(value)` を使う方針とする。[Node.js 22.12.0のutil.types](https://nodejs.org/download/release/v22.12.0/docs/api/util.html#utiltypes)はJavaScriptから参照できるpropertyを調べず型を判定すると説明し、[types.isProxy](https://nodejs.org/download/release/v22.12.0/docs/api/util.html#utiltypesisproxyvalue)を提供する。ローカルの型宣言は `node_modules/@types/node/util/types.d.ts:400`。外部依存やI/Oを加えず、Object.getPrototypeOf・own key列挙・descriptor取得より先にProxyを拒否する。getterやtoJSONを呼んで成否から型を推測しない。

計画確認用の合成ProxyをNode 24.21.0でtypes.isProxyに渡し、get/getPrototypeOf/ownKeys/getOwnPropertyDescriptorのtrap呼出しが0のままtrueになることを観測した。通常object/Arrayはfalseであった。Node 22.12.0で同じ合成入力を実行した証拠ではないため、実装後の対応Node/3OSの試験は別途必要である。

numberは丸め・null化せず、負の0も保持する。objectの欠落したkeyを作らず、own undefinedはownのまま複製する。Arrayの長さと順序は維持する。frozen/readonlyな入力も、対象data propertyなら入力を変更せず受理する。出力propertyのwritable/configurableやfreezeの再現は契約外で、通常のdata propertyにする。

出力objectは入力と同じObject.prototype/nullの種類で作り、own keyは安全なdata propertyとして定義する。`__proto__`・`constructor`・`prototype`を特別な設定として解釈しない。keyも既存maskSecretsで置換するので、書き込む前に置換後keyの衝突を検査する。新しいsecret keyの推定規則は作らない。

祖先の参照を追跡して循環を拒否する。訪問済みというだけで拒否せず、共有された子は各出現を独立して複製する。処理中のstackを明示的に管理し、正常な深い入れ子を再帰呼出し上限に依存させない方針とする。新しい設定や数値上限は加えない。

拒否はUsageErrorとし、固定した日本語の理由だけを返す。message/causeに入力、元key、部分結果を入れない。Tは既存構造を受け渡す型であり、文字列リテラルの値や置換されたkeyの同一性を保証しない。

## REQ-207とB01

現行REQ-207はruntimeに置く責務の例を挙げており、ファイル数を4個に固定してはいない。既知の秘密の置換を責務の例に加えるMODIFIEDを提案するが、依存の許可・禁止やruntimeから機能への参照禁止は変えない。既存本文と4Scenarioを全文保持し、同じ許可・禁止が共通の置換処理にも適用される責務の文を1つ追記する。ファイル名や数の固定は製品仕様に加えない。

`tests/kit-layers.test.ts:36`の正確な一覧には2ファイルを足す必要がある。実ファイルは未変更で、管理役用の未適用差分は `.loomake/design65/p1-approval.patch`。変更案は既存4項目をすべて残してprivate-key-stream.tsとredact.tsだけを足す1行であり、同じtoEqual・forbiddenImports・全禁止例を維持する。

当初は期待値が変わるという理由だけで追加承認を要求したが、管理役は独立確認後にその解釈を訂正した。REQ-207はファイル数を固定しておらず、元4項目・全禁止依存・未知ファイル拒否を保ち、新2moduleにも同じ検査を適用する仕様追従である。通常L3の採用仕様とADR0006に基づき進め、新たな利用者承認があったとは扱わない。別ディレクトリへの移動や検査の弱体化は行わない。独立確認の事実は `.loomake/design65/inventory-independent-audit.md` に保持する。

## 試験と受入

新しいkitの試験でREQ-447の全Scenarioを確認する。既存runnerのmask、diagnostic-redactor、private-key-redaction、run-start-maskとpackage-artifactsを実行し、元のmodule pathと配布物も確認する。診断メモリfixtureはrunnerの旧ソース2本だけを一時フォルダーへ複写するため、単純な再exportを解決できないという見落としが実装時に分かった。管理役はADR0005に基づき、読取元を共有redact/private-key-stream/errorsへ追従する開発基盤修理を採用した。全assert・入力・old space 32MiB・処理量64MiB・spawn 15000msと試験18000msを保ち、ほかの既存試験を変更しない。メモリ試験は従来と同じ実装層を対象とし、kit全入口やアプリ全体のメモリ保証にはしない。test nameのREQ IDを残し、秘密には認証に使えない合成fixtureだけを使う。

B01の管理役分類に従うREQ-207の検査は追加2moduleも含むruntimeを走査する。元4項目、全assertion、forbiddenImports、全禁止例が保持されていることを差分でも確かめる。

仕様ゲート成功後に実装し、全tasks、local done、CI done、必須5チェック、変更packageの3OS、非著者Codexと独立Opusのレビューを通す。実装のmainマージ後の仕様同期/archiveは管理役が続けて扱う。

## REQ-447とScenarioの対応

REQ-447の規範本文は1つとし、500文字以内にまとめた。受理値・拒否・複製・公開互換の細部は次の12ScenarioのTHEN/ANDに保持する。Sourceを複数の新Requirementへ重複させない。

| Scenario | 規範の細部 |
|---|---|
| 既存のプレーン文字列の置換を共有する | 4公開関数、既知の形、Bearer/JSON/途中出力、任意の秘密の非保証、純粋性 |
| 診断ストリームと秘密鍵フィルターを共有する | 同一関数、chunk/保留量/終端 |
| JSONのプリミティブと空の値を保つ | 署名T、文字列/key置換、深い複製、finite/-0、Array/objectの受理範囲 |
| 入れ子とoptional undefined | own enumerable data、欠落とundefined/null、key順序 |
| JSONデータの範囲外を拒否する | root/Array undefined、非finite、bigint/function/symbol/非plain/ProxyのUsageError |
| getterやtoJSONを実行しない | accessor/symbol/nonenumerableを拒否し実行しない |
| Arrayの穴と追加propertyを拒否する | 通常Array prototype、dense/own/indices/length、extra property拒否 |
| prototypeに見えるown key | own __proto__/constructor/prototype、安全な定義、prototype維持、cloneのdescriptor |
| 循環ではない共有参照 | 出現ごとの独立clone |
| 循環 | 自己/相互参照の拒否、入力内容を例外へ載せない |
| keyの衝突 | cycleと衝突拒否の完全な条件、破棄/上書き禁止、message/causeの秘匿 |
| 配布後の既存公開元 | runner再export、dist/mask.js、既存assert・入力・上限保持、fixture読取元追従、runtime依存追加なし |
