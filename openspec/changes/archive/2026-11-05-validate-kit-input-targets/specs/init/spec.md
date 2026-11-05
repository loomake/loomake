## ADDED Requirements

### Requirement: 通常のファイルでない置き先での無配置中止
init は、既存のリンクの検査を先に行い、そのあと既存の配置対象と `.gitignore` が通常のファイルであることと、途中の要素が通常のディレクトリであることを、配置対象の読み取りと全書き込みより前に確かめる SHALL。不正な種類があれば、種類と移動か削除の案内を日本語で示す UsageError とし、何も作成・変更しない MUST。既存の外部・リンク先のないリンクの中止は終了コード 1 のまま保ち、種類の誤りは終了コード 2 とする SHALL。

Source: REQ-425

#### Scenario: 配置対象がディレクトリ
- **WHEN** AGENTS.md または .gitignore がディレクトリである
- **THEN** 確認も差分表示もせず、何も配置せず、日本語でディレクトリの移動か削除を案内して終了コード 2 を返す

#### Scenario: 途中の要素がファイル
- **WHEN** .claude または .github が通常のファイルである
- **THEN** 途中の要素がディレクトリでないことを案内し、何も配置せずに終了コード 2 を返す

#### Scenario: 通常のファイル以外の対象
- **WHEN** 配置対象が通常のファイルでもディレクトリでもない
- **THEN** 通常のファイルでないことを正しく案内し、読み取らずに UsageError にする

#### Scenario: リンクの中止を優先する
- **WHEN** 外部リンクと種類の誤った置き先が同時にある
- **THEN** 既存のリンクの案内と終了コード 1 を優先し、何も配置しない

### Requirement: report の除外行の正規化とエスケープ
init は、最終的に残る config の report を正規化・安全検査してから、全ファイルを書く SHALL。保持する設定が不正なら無配置で UsageError とし、上書きする旧設定は生成する設定の値で検査する SHALL。report の gitignore 行は root からの文字どおりのパスとし、先頭の `#`・`!`、パターン文字、意味のある空白をエスケープし、区切りのない名前には root の `/` を付ける SHALL。既存の行の内容を保ち、同じ除外行を重複して足さず、既定の `.loomake/test-report.json` の行は変えない SHALL。doctor の案内も同じ正規化値と除外行を使う SHALL。

Source: REQ-426

#### Scenario: 特別な文字の名前
- **WHEN** report の先頭が `#`・`!`・空白、またはパターン文字や末尾の空白を含む
- **THEN** 対象の root 内のパスだけを文字どおりに除外し、2 回目の init は同じ行を足さない

#### Scenario: 冗長なパスと区切り
- **WHEN** report が冗長な区切り、`.`、またはバックスラッシュを使う
- **THEN** 正規化した POSIX のパスで同じ行を作り、verify と doctor と run も同じ値を使う

#### Scenario: 保持する report が不正
- **WHEN** keep または確認で残す config の report が root の外を指す
- **THEN** 既存内容と他の配置対象を一切変えず、終了コード 2 を返す

#### Scenario: 不正な旧設定を上書きする
- **WHEN** --yes で不正な旧 report を持つ config を生成内容へ上書きする
- **THEN** 生成内容の安全な report で検査と除外を行い、導入を完了できる

#### Scenario: 既定の除外行
- **WHEN** 既定の report を使い、既存の .gitignore にその行がある
- **THEN** 既存行と既存の前後の内容は変更しない
