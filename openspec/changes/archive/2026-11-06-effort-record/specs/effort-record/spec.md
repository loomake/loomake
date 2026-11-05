## Purpose

利用者が申告した人の実作業時間を、品質検証の結果から独立した追記専用の記録として保存する。単位と欠測を明確にし、再オープン後も既存の記録を保ち、品質の合格や人力開発との実測比較を作り出さない。

## ADDED Requirements

### Requirement: 人の実作業時間の独立した記録

`loomake trace record --change <id> --effort <時間>` と同期APIは以下の入力・境界・保存契約を満たす人の実績をEffort 1へ追記する SHALL。自由記述と入力由来の診断には共通の秘密置換を適用する MUST。verifyと検証文書のsnapshotを作らず、品質合格の証拠としない MUST。未コミット拒否・追記専用・オフラインのREQ-067・068・084を維持する MUST。既存record、Evidence 1/2、Report 2、公開JSON Schema12本、依存、同期実行を保持する MUST。

Source: REQ-466

#### Scenario: 単位を明示した総計
- **WHEN** 未コミットの変更がない有効なchangeに `--effort 90m` または `--effort 1.5h` を指定する
- **THEN** `totalMinutes: 90` として1つの新しい記録を保存し、`minutes` は保存しない。終了コード0と、保存先およびgitへコミットする日本語の案内を返す

#### Scenario: 区分と内数
- **WHEN** `--effort instruct=30m,review=20m,rework=0m,run=10m,wait=5m,search=8m` を指定する
- **THEN** `minutes` に6つの指定値を整数分で保存し、`totalMinutes` は保存しない。searchの8分は5区分の合計65分の内数であり、合計に再加算しない

#### Scenario: 0と省略の区別
- **WHEN** `--effort review=0m` を指定する
- **THEN** `minutes.review` に0を保存し、他の区分は省略する。省略を0で補わず、全体の総計を作らない。`0m` と `0h` の総計も観測値0として受け付ける

#### Scenario: 時間の字句と正規化後の境界
- **WHEN** 分の値が `^(0|[1-9]\d{0,5})m$`、または時間の値が `^(0|[1-9]\d{0,3})(\.\d{1,2})?h$` に一致する
- **THEN** 十進値を正確に整数分へ変換でき、変換後の各時間値が0〜100000分の場合だけ受け付ける。`100000m`、`1.5h`、`0.05h` は受理し、`100001m`・`999999m`・`0.01h`・`9999h` は終了コード2で何も保存しない

#### Scenario: 不正な時間の構文
- **WHEN** 空白・符号・指数表記・全角文字・単位なし・先頭ゼロを含む時間、`NaN`、`Infinity`、同じ区分の重複、未知区分、総計と区分の混在、searchだけ、またはsearchが記録した5区分の既知合計を超える入力を渡す
- **THEN** 日本語の使い方の誤りを返し、終了コード2で何も保存しない。`--effort=` も既存どおり拒否する

#### Scenario: 既存のオプション構文
- **WHEN** 値付きオプションを空白区切りまたは等号区切りで渡し、同じオプションを繰り返す
- **THEN** 両構文を受け付け、最後のオプション値を使う。新しい入口をhelpと生成CLIリファレンスにも表示する。既存の未知オプション・位置引数の拒否を保つ

#### Scenario: 判断要求と試行の任意入力
- **WHEN** `--decisions` または `--attempts` に0以上の安全な整数を指定する、または省略する
- **THEN** 指定された値だけを保存し、省略を0で補わない。負数・小数・非有限値・安全整数を超える値は終了コード2とする。M1の問いの数やM2のゲート停止回数から推定しない

#### Scenario: 費用の明示と異なる区分
- **WHEN** `--cost actual-usd:1.25,estimated-usd:0.50,tokens:12000` を指定する
- **THEN** `cost` の配列に実額125cents・推計50cents・tokensのcount12000をそれぞれのkindとともに保存し、区分をまたいで合算しない。USDは非負の十進値で小数最大2桁を整数centsに正確に変換し、tokensは非負の整数とする。保存する各値は安全整数以内とする

#### Scenario: 不正または欠測の費用
- **WHEN** 費用を省略する、または未知・同一kindの反復・定額・負数・指数表記・USDの小数3桁以上・tokensの小数・安全整数を超える費用を指定する
- **THEN** 省略はcost自体を省略し、無料・0・実額へ補完しない。不正入力は終了コード2で何も保存しない。費用入力だけでM5の単価出典・日付・取得範囲・トークン内訳がそろったと表示しない

#### Scenario: メモの上限
- **WHEN** `--note` にUnicode codepointで500文字以内の文を指定する
- **THEN** 改行と制御文字を含まなければ共通置換後の値を保存する。501文字以上、改行、制御文字は終了コード2で何も保存しない。省略時はnoteを補わない

#### Scenario: 自由記述と診断の秘密置換
- **WHEN** noteまたは入力由来の診断に、kitの共通置換が対象とする既知の秘密の形が含まれる
- **THEN** 最終レコードと診断へ同じ共通置換を適用し、原文をファイル・stdout・stderr・例外のmessageやcauseへ残さない。最終置換後に構造・文字数・65536bytesの上限を検査し、不正なら公開しない。独自のpatternや複製を作らず、任意の秘密や個人情報を検出できるとは保証せず、それらを入力しない案内を持つ

#### Scenario: effort専用オプションの組み合わせ
- **WHEN** `--effort` なしで `--decisions`・`--attempts`・`--cost`・`--note` を指定する、または `--effort` と `--scope` を併用する
- **THEN** 終了コード2で何も保存せず、verifyも実行しない

#### Scenario: Effort 1の保存形式
- **WHEN** 正しい実績入力を保存する
- **THEN** `.loomake/evidence/<change-id>/effort/<YYYYMMDDTHHMMSSZ>-<HEADのSHA先頭12文字>.json` へ、2字下げ・末尾改行のUTF-8 JSONを保存する。`schemaVersion: 1`・`kind: "loomake-effort"`・change・40または64桁hexのHEADのsha・ISO 8601のrecordedAtを持ち、minutesとtotalMinutesは排他的とする。totalMinutesモードにsearchを保存せず、任意項目は指定されたものだけを持つ

#### Scenario: 出力のサイズ境界
- **WHEN** 整形後の末尾改行を含むUTF-8 JSONが65536bytesちょうど、またはそれを超える
- **THEN** ちょうどは受け付け、超えたら終了コード2で保存しない。保存前に構造と値を検証し、不正な生成データも公開しない

#### Scenario: 未コミットの変更
- **WHEN** 追跡済みまたは未追跡の未コミットの変更がある状態で時間を記録する
- **THEN** REQ-067どおり、変更を日本語で示して終了コード1とし、記録しない。gitignoreで除外された変更だけなら受け付ける。記録後の未コミットのeffortファイルも次回の拒否対象にする

#### Scenario: 再オープン後の追記
- **WHEN** 同じchangeへの記録をコミットしたあと、時刻を変えて追加の人の作業時間を記録する
- **THEN** 新しいファイルを1つ追加し、以前の記録の内容を変えない。品質検証、実績の自動推定、既存値への上書きを行わない

#### Scenario: 同じ保存名の原子的な衝突拒否
- **WHEN** 同じchange・UTC秒・HEADから同じ保存名へ公開しようとし、既存ファイルがある、または同時に複数の公開が衝突する
- **THEN** 既存名を上書きしない。同時に同じ名へ成功する公開は1件までで、衝突側は終了コード1とする。時刻やHEADが異なる記録の直列化やexactly-onceの保証は含めない

#### Scenario: archive後とchangeの不正
- **WHEN** 有効なactive changeまたは一意に解決できるarchive済みchangeを指定する、あるいは不正なid・`archive`・存在しないchange・あいまいなarchiveを指定する
- **THEN** activeを優先する既存の探索を使い、前者は同じchange-idのeffortサブディレクトリへ記録する。後者は終了コード2で何も保存しない。changeの文書内容は読まず、gitが利用できない場合も日本語の使い方の誤りとする

#### Scenario: 品質検証と記録の分離
- **WHEN** `--effort` の記録を実行する
- **THEN** verify・品質コマンド・quality schemaのロード・trace.mdと差分仕様の読取およびsnapshot・検査前後の文書hash照合を行わず、verify結果やdocumentsをEffort 1へ作らない。時間の記録をローカル完了や最終CI合格と表示しない

#### Scenario: 既存の証拠選択と再利用
- **WHEN** 正しいeffortサブディレクトリと既存Evidence 1/2が同じchangeの証拠ディレクトリにある
- **THEN** release reportとrunnerはeffortをverify証拠や再利用候補にせず、既存の結果とJSON外形を保つ。公開JSON Schema12本と旧fixture、既存の同期API・依存・遅延ロードを保持する

#### Scenario: オフラインと既存record
- **WHEN** ネットワークがない環境で時間を記録する、または `--effort` を指定せず既存のrecordを使う
- **THEN** 時間の記録はネットワークなしで動作する。既存recordは従来のverify・文書保存・変更検知・終了コードと出力をそのまま保ち、runnerの呼出も変えない
