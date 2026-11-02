## MODIFIED Requirements

### Requirement: 品質scriptの静的な確認
次を満たす SHALL。単純なnpmのrun・run-script・testとpnpmのrun・run-script・test・lint・typecheckは、ルートpackage.jsonを予算内で読み、scriptsの対象が空でない文字列か確認し、不一致なら対象と直し方を問題にする。scriptは実行しない MUST。存在しても本文の成功・引数の正しさを保証しない。run後の名は英数字・-_.:に限り、正規表現・対象変更オプション・npm run env組込み・Yarn run-scriptを推測せず未対応とする。package.json不在は該当commands/script名だけで問題1件とし、loomake.config.jsonのcommandsを本プロジェクトのコマンドへ直すか、package.jsonと対象scriptsを作る両案を示す。既存package.jsonの読取不可・形式/容量不正は原因を問題とし「package.json を確認できません」、案内「package.json の形式・容量・読み取り権限を確認してください」を示す。

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
