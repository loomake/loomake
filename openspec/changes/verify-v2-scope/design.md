# Design: verify-v2-scope

## 入口を1か所にする

`--scope` の受理値は `args.ts` の `SCOPES` に置き、verify・trace recordのオプション定義とmain.tsの検査が同じ値を使う。help・usage・`5.cli.md` は同じ定義から出る。値の検査は `main.ts` の `scopeOption` で行い、省いたときは `undefined` を渡して、既定値は呼ばれる側が決める。

## 既定値はAPIが持つ

`runVerify` は `scope` を省くと、doneならci、それ以外はlocalにする（2b-1/6から変わらない）。CLIは既定値を自分で補わないので、APIとCLIで結果と終了コードがずれない。環境変数 `CI` は読まない。明示したscopeは、changeの有無にかかわらず指定どおりに扱い、特別な拒否はしない（changeなしのciの扱いはverify-v2-gatesのREQ-037・039に従う）。

## trace record

`runRecord` は2b-1/6から `scope`（既定ci）を受け取る。CLIは値を検査して渡すだけで、記録の内容は変えない。localの記録が最終CI合格を表さないことは、既存の挙動のまま。

## 基準の差分の書き方

差分は旧文の1行を新文に置き換える形のまま、次の2点を足した。`stream: stderr` と `entry`（何番目の出力か。使い方の誤りでは、理由が0番目、使い方が1番目）、新文が複数行でもよいこと（optionの説明行を足すため）。省いた場合の既存の検査（旧文が1行だけ、出力が1回だけ、新文がすでにない）は変えない。
