## MODIFIED Requirements

### Requirement: 検証済み証拠の安全な再利用
再実行でもlocal完了ゲートを省略しない SHALL。作業ツリー未変更、直前コミットが親1つ・対象changeの証拠1つだけの追加で、形式・SHA・change・正規local completed/partial完了・文書snapshotが一致するEvidence 2/verify 2.0.0に限り、同じ証拠とコミットで外部操作を再試行する SHALL。候補のJSON破損やSHA/change/文書不正と、正常Evidence 2のci・local未完了・要判断・aborted等の再利用条件不一致は区別して理由を示し、削除/上書きせず止まる SHALL。正常な旧Evidence 1は再利用/最終CI合格に使わず、旧ファイルを保ち新v2検証・記録へ進む SHALL。直前が再利用候補でない別実装/文書変更の場合も通常記録する SHALL。

Source: REQ-164

#### Scenario: pushやPR作成の失敗後に再実行する
- **WHEN** Evidence 2のlocal完了証拠のコミット後にpushまたはPR作成が失敗し、状態を変えず再実行する
- **THEN** local完了ゲートを再実行し、SHA/文書と新しいlocal結果を確認して同じ証拠とコミットで外部操作を再試行する。証拠の使い回しで品質実施やci合格を補わない

#### Scenario: 不正な証拠が直前にある
- **WHEN** 候補の証拠のJSON・SHA・合格結果・文書の対応に誤りがある
- **THEN** 証拠と作業状態を保ち、理由を示して止まる

#### Scenario: 証拠の後で実装を変更した
- **WHEN** 証拠のコミットの後に実装変更をコミットして再実行する
- **THEN** 新しい実装に対する検証と新しい証拠記録を行う

#### Scenario: 旧証拠しかない
- **WHEN** 直前の証拠が旧形式として正しく読めるEvidence 1/verify 1.0.0である
- **THEN** 外部操作の再試行用に合格証拠として再利用せず、通常の新しいv2検証とEvidence 2記録へ進む。版の違いだけで不正停止にせず、旧ファイルは削除しない。JSON破損やSHA/change/文書対応不正の停止条件は維持する

#### Scenario: 正常v2でも再利用条件に合わない
- **WHEN** 直前が対象changeの証拠だけのコミットで、正常Evidence 2がci、local未完了、要判断またはabortedである
- **THEN** JSON破損と混同せずlocal再試行条件不一致として理由付きで状態を保ち停止する。正規local completed/partial完了は同じ条件で再利用でき、正常旧Evidence 1の移行例外とは分ける

### Requirement: 完了ゲートと直し
すべてのタスクを終えたら、`loomake run` は完了ゲート（`verify --done --scope local` と同じ検査）を実行する SHALL。REQ-205の純粋判断が再修正を選ぶ不合格なら、その内容をエンジンへ渡して直させ、変更があれば直しを `run(<change-id>): 完了ゲートの直し（N 回目）` でコミットし、完了ゲートを再実行する SHALL。変更がなければREQ-331に従い再実行せず止まる SHALL。完了ゲートのタスクはエンジンに渡さず、local完了ゲートが0で要判断/abortedがないときにrunがローカル完了とする SHALL。CIの最終合格とは区別する MUST。行に `<!-- loomake:gate=done -->` の印があれば完了ゲートのタスクとする SHALL。印がなく本文に `verify` と `--done` を含めば旧書式の完了ゲートのタスクとみなし、印を付けるよう案内を表示する SHALL。エンジンへの指示とコミットメッセージには、印を除いたタスクの文を使う SHALL。

Source: REQ-100

#### Scenario: 直して合格する
- **WHEN** 1 回目の完了ゲートに不合格になり、エンジンが直したあとの 2 回目で合格する
- **THEN** エンジンへの 2 回目の指示に 1 回目の不合格の内容が含まれ、直しが「完了ゲートの直し（1 回目）」でコミットされ、完了ゲートのタスクが `- [x]` になる

#### Scenario: 完了ゲートのタスクはエンジンに渡さない
- **WHEN** tasks.md の最後のタスクが「`pnpm -s verify --change c1 --done` を通す」の change を実行する
- **THEN** そのタスクはエンジンに渡されない

#### Scenario: 印のあるタスク
- **WHEN** tasks.md の最後のタスクが「品質の確認を通す <!-- loomake:gate=done -->」の change を実行する
- **THEN** そのタスクはエンジンに渡されず、完了ゲートに合格したときに `- [x]` になる

#### Scenario: 旧書式のタスク
- **WHEN** 印がなく、本文が「`pnpm -s verify --change c1 --done` を通す」のタスクを持つ change を実行する
- **THEN** そのタスクはエンジンに渡されず、行に `<!-- loomake:gate=done -->` を付けるよう案内が表示される

#### Scenario: 印は指示とメッセージに含めない
- **WHEN** 印のある完了ゲートのタスクを持つ change で、完了ゲートに不合格のまま直しの回数の上限に達して止まる
- **THEN** 残ったタスクの表示と summary.json の完了ゲートのタスクに `<!-- loomake:gate=done -->` が含まれない

### Requirement: 仕様ゲートの確認
`loomake run --change <id>` は、最初にその change の仕様ゲート（`verify --spec-only --scope local` と同じ検査）を実行する SHALL。通常の不合格は終了コード1、usage/configのabortedは2、その他のabortedは3で止まり、理由を表示する SHALL。不合格とabortedでは実装ブランチを作らず、エンジンを呼ばない MUST。

Source: REQ-093

#### Scenario: 仕様ゲートに不合格
- **WHEN** 未回答のブロッキング確認事項がある change に `loomake run --change c1` を実行する
- **THEN** 確認事項の内容が表示され、ブランチは作られず、エンジンは呼ばれず、終了コードは 1 である

#### Scenario: 仕様ゲートに合格
- **WHEN** 仕様ゲートに合格する change に `loomake run --change c1` を実行する
- **THEN** 実装に進む

#### Scenario: 仕様ゲートの実行エラー
- **WHEN** 仕様ゲートがusage/config、またはその他の実行エラーのabortedを返す
- **THEN** 前者は終了コード2、後者は3で止まり、理由を表示し、実装ブランチを作らず、エンジンを呼ばない
