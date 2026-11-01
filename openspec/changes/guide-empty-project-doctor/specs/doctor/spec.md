## MODIFIED Requirements

### Requirement: 品質scriptの静的な確認
単純なnpm run・run-scriptとnpm test、pnpm run・run-scriptとpnpm test・lint・typecheckの呼び出しは、ルートのpackage.jsonを予算つきで読み、scriptsに対象の空でない文字列があるか確認する SHALL。ない場合やpackage.jsonの形が不正な場合は問題とし、対象と直し方を示す SHALL。scriptの本文は実行しない MUST。scriptがある場合も、本文の成功や引数の正しさを保証しない SHALL。runの後のscript名は通常の英数字・ハイフン・アンダースコア・ドット・コロンに限り、正規表現の指定やオプションで対象が変わる呼び出しは未対応として扱う SHALL。npm run envの組み込み処理とYarnのrun-script表記も、scriptを推測せず未対応とする SHALL。

ルートに package.json がない場合は、該当する commands の名前を挙げて問題とし、報告を 1 件にまとめる SHALL。直し方には loomake.config.json の commands をこのプロジェクトで使うコマンドに書き換える方法と、package.json を作って対象の scripts を書く方法の両方を示す SHALL。commands と scripts の名前はそれぞれ該当する設定名と呼び出し先の script 名だけを挙げる SHALL。package.json があるが読み取れない場合や形式・容量が不正な場合は、従来どおり「package.json を確認できません」と原因を問題として示し、「package.json の形式・容量・読み取り権限を確認してください」と案内する SHALL。

Source: REQ-184

#### Scenario: scriptがない
- **WHEN** commands.testがpnpm testで、package.jsonにtestのscriptがない
- **THEN** testの欠落を問題とし、package.jsonのscripts.testと設定の確認を案内する

#### Scenario: scriptの本文がある
- **WHEN** 単純な呼び出しに対応する空でないscriptがある
- **THEN** 存在を合格とし、品質コマンドを実行しない

#### Scenario: package.json がない
- **WHEN** commands.test が `npm test` で、実行ファイルは見つかるがルートに package.json がなく、ほかの診断項目は整っている
- **THEN** 「package.json がありません。commands.test の script を確かめられません」を問題として 1 件だけ表示し、「loomake.config.json の commands をこのプロジェクトで使うコマンドに書き換えるか、package.json を作って scripts.test を書いてください」と案内し、終了コードは 1 である

#### Scenario: 複数の commands に対応する package.json がない
- **WHEN** commands.lint が `npm run lint`、commands.typecheck が `pnpm run typecheck`、commands.test が `npm test` で、実行ファイルはすべて見つかるがルートに package.json がなく、ほかの診断項目は整っている
- **THEN** commands.lint・commands.typecheck・commands.test の script を確かめられないことを問題として 1 件だけ表示し、commands の書き換えか、package.json と scripts.lint・scripts.typecheck・scripts.test の用意を案内し、終了コードは 1 である

#### Scenario: commands の名前と script の名前が異なる
- **WHEN** commands.test が `pnpm run check` で、実行ファイルは見つかるがルートに package.json がなく、ほかの診断項目は整っている
- **THEN** commands.test の script を確かめられないことを問題として 1 件だけ表示し、commands の書き換えか、package.json と scripts.check の用意を案内し、終了コードは 1 である

#### Scenario: package.json の JSON が不正
- **WHEN** commands.test が `npm test` で、実行ファイルは見つかるが package.json の JSON が不正で、ほかの診断項目は整っている
- **THEN** 「package.json を確認できません」と原因を問題として 1 件だけ表示し、「package.json の形式・容量・読み取り権限を確認してください」と案内し、終了コードは 1 である

#### Scenario: 空のプロジェクトで init のあと doctor を実行する
- **WHEN** git init 済みで npm があり、openspec/ と package.json がない新しいディレクトリで `loomake init` のあとに `loomake doctor` を実行する
- **THEN** doctor の問題は「openspec/ がありません」と、package.json がなく commands.lint・commands.typecheck・commands.test の script を確かめられないことの 2 件であり、それぞれ直し方を表示し、終了コードは 1 である
