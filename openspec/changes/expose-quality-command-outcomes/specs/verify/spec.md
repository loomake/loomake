## ADDED Requirements

### Requirement: 品質コマンドの終わり方の任意通知
kit の verify API は、任意の通知先へ品質コマンド名と実行経路で得た終わり方を一度ずつ実行順に通知 SHALL。公開型は exited と数値 status、signal と信号名、error と code（不明は null）、timeout・interrupted・output と任意 reason を区別する SHALL。起動前に期限が尽きた訪問済みコマンドは timeout、終了情報が欠けた結果は error・code:null とする SHALL。省略・空設定・早期終了後の未訪問コマンドと品質コマンド以外の外部操作は通知しない MUST。

Source: REQ-455

#### Scenario: 正常な0と非0を実行順に通知する
- **WHEN** 通知先を指定して lint・typecheck・test と追加コマンドを実行し、それぞれ数値の終了状態が得られる
- **THEN** 各コマンドについて設定済みの既存実行順に一度だけ exited と元の status が届き、非0を起動失敗へ変換しない

#### Scenario: 信号と起動の失敗を区別する
- **WHEN** 実行結果に signal がある場合と error がある場合を受け取る
- **THEN** error があれば error と元の code（不明は null）を、error がなく status が null で signal があれば signal と元の信号名を通知する

#### Scenario: 終了情報を失った結果
- **WHEN** 実行結果の status と signal が null で error もない
- **THEN** error・code:null を通知し、正常な数値終了を作らない

#### Scenario: 実行の上限と中断
- **WHEN** 実行経路が timeout・interrupted・output の上限例外を返す
- **THEN** その kind と存在する reason を元のコマンド名で一度通知する

#### Scenario: 起動前に実行時間を使い切る
- **WHEN** コマンドを訪問した時点で既存の合計期限が尽きている
- **THEN** 外部実行を増やさず、そのコマンドの timeout を一度通知する

#### Scenario: 実行しないコマンド
- **WHEN** 品質コマンド全体を省略する、コマンド設定が空である、仕様ゲートで品質コマンドを実行しない、または早期終了後に未訪問のコマンドが残る
- **THEN** 対象コマンドの通知を作らず、通知欠落から実行済みや完了を推定しない

#### Scenario: change を指定した完了ゲート
- **WHEN** change 付き完了ゲートに通知先を指定して品質コマンドを実行する
- **THEN** change 省略時と同じ通知契約を使い、仕様検査の外部操作を品質コマンドとして通知しない

### Requirement: 通知追加時の verify の互換性
kit は `VerifyOptions.onCommand` と `QualityCommandOutcome` を公開し、通知先を指定しない既存利用を維持する SHALL。正常に戻る通知先の有無で、同一の実行結果に対する verify の結果・JSON・終了コード・検査と実行の順序・実行回数・期限・共有予算・既存例外を変えない MUST。通知先が投げた値は progress と同様に同一の値を呼出元へ伝え、その後の実行を止める SHALL。通知オブジェクトの変更は元の実行結果や後続通知を変更しない MUST。

Source: REQ-456

#### Scenario: 既存利用と型の利用
- **WHEN** 既存の VerifyOptions 利用と、新しい公開型で onCommand を受け取る利用を型検査する
- **THEN** 両方が成功し、追加の依存や CLI 設定を要求しない

#### Scenario: 通知を追加しても同じ結果を返す
- **WHEN** 同じ成功・通常失敗・信号・起動失敗・上限の入力を通知なしと正常に戻る通知ありで実行する
- **THEN** verify の戻り値全体とその JSON・終了コードが一致し、追加実行・新しい期限・予算の変更がない

#### Scenario: 通知先が例外を投げる
- **WHEN** 通知先が通常の Error または実行上限例外を含む値を投げる
- **THEN** 同一の値が呼出元へ伝わり、実行失敗の通知へ変換・握り潰し・再通知をせず、後続コマンドを起動しない

#### Scenario: 通知の変更から実行結果を保護する
- **WHEN** 通知先が受け取った name・kind・status を書き換える
- **THEN** verify の戻り値と元の実行状態、別コマンドの通知には変更が伝わらない

#### Scenario: 既存の表示と公開形式を維持する
- **WHEN** 通知を渡さない既存の CLI と JSON 利用を実行する
- **THEN** 表示・公開 JSON・終了コード・既存 report 読取りの結果が変わらず、通知内容を JSON へ追加しない
