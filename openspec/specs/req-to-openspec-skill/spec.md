# req-to-openspec-skill Specification

## Purpose
`@loomake/kit` が配布する req-to-openspec Skill のテンプレートに書く手順を定める。Markdown の要件書を読み、要求文を出典つきで要件台帳に載せ、曖昧さを確認事項か仮定に記録し、change に分けて書き出し、最後に報告するまでを含む。Markdown 以外の要件書は読まずに変換を求め、変換の処理や指示は持たない。

## Requirements

### Requirement: 読める要件書の形式
Skill は Markdown（.md）の要件書を読む SHALL。Markdown 以外の形式の要件書を渡されたときは読まずに、利用者に Markdown へ変換してから渡すよう求める MUST。

Source: REQ-025

#### Scenario: Markdown を読む
- **WHEN** Skill テンプレート（SKILL.md）を読む
- **THEN** 入力が Markdown（.md）の要件書であることが書かれている

#### Scenario: Markdown 以外を渡されたとき
- **WHEN** Skill テンプレートを読む
- **THEN** .docx・.xlsx・.pdf などを渡されたときは読まず、Markdown への変換を利用者に求めるよう指示されている

### Requirement: 台帳づくりの手順
Skill は要件書の要求文を 1 文ずつ採番し、出典（文書名・章と行）つきで要件台帳に載せる手順を定める SHALL。REQ の番号は、リポジトリにある trace.md（進行中と archive の change）に出てくる最大の REQ 番号の次から振り、trace.md が 1 つもなければ REQ-001 から振るよう定める SHALL。REQ・Q・A の番号は、change をまたいでも同じ番号を使い、Q・A は要件書 1 冊の中で通し番号にするよう定める SHALL。

Source: REQ-026

#### Scenario: 採番と出典の指示がある
- **WHEN** kit の Skill テンプレート（SKILL.md）を読む
- **THEN** 1 文ずつ載せること、出典に文書名・章と行を書くことが指示されている

#### Scenario: 既存の番号の次から振る指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** リポジトリにある trace.md の最大の REQ 番号の次から振ること、trace.md がなければ REQ-001 から振ることが指示されている

#### Scenario: 通し番号の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** REQ・Q・A を change をまたいでも同じ番号で使い、Q・A を要件書 1 冊の中で通し番号にすることが指示されている

### Requirement: 曖昧さチェックリストの適用
Skill は曖昧さチェックリストを全要件にあて、確認事項（Q）または仮定（A）として記録する手順を定め、チェックリスト自体を同梱する SHALL。要件書に未決事項の章や表があるときは、その項目をすべて確認事項にし、質問に要件書側の ID を書くよう定める SHALL。関係する要件がすべて後のフェーズの未決事項は、ブロッキングにしないよう定める SHALL。

Source: REQ-027

#### Scenario: チェックリストが同梱されている
- **WHEN** Skill テンプレートのディレクトリを読む
- **THEN** 曖昧さチェックリストのファイルがあり、SKILL.md が全要件に適用して Q または A に記録するよう指示している

#### Scenario: 未決事項の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 要件書の未決事項をすべて確認事項にすること、質問に要件書側の ID を書くこと、関係する要件がすべて後のフェーズならブロッキングにしないことが指示されている

### Requirement: 必ずブロッキングにする分類
Skill はお金・個人情報・権限・データ削除・外部連携・受け入れの数値に関わる曖昧さを、必ずブロッキングな確認事項にするよう定める SHALL。

Source: REQ-028

#### Scenario: 6 つの分類が列挙されている
- **WHEN** Skill テンプレートを読む
- **THEN** お金・個人情報・権限・データ削除・外部連携・受け入れの数値の 6 つが、仮定にしてはいけないものとして列挙されている

### Requirement: change への分割と分割案の提示
Skill は要件書をリリースの単位の change に分割し、分割案を人に示してから書き出すよう定める SHALL。複数の change にかかわる要件と確認事項は、かかわる change それぞれの trace.md に、同じ番号・同じ内容の行で載せるよう定める SHALL。

Source: REQ-029

#### Scenario: 分割の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 1 change をリリースの単位とすること、分割案を人に示して合意を取ることが指示されている

#### Scenario: 複数の change にかかわる行の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** 複数の change にかかわる要件と確認事項を、かかわる change それぞれの trace.md に同じ番号・同じ内容で載せることが指示されている

### Requirement: Requirement の書式
Skill は、各 Requirement に SHALL または MUST の規範文、`Source:` 行、1 つ以上の Scenario を含めるよう定める SHALL。

Source: REQ-030

#### Scenario: 書式の指示と雛形がある
- **WHEN** Skill テンプレートの書式の参照ファイルを読む
- **THEN** 規範文・`Source:` 行・`#### Scenario:` を含む雛形があり、SKILL.md が 3 つを必須とする

### Requirement: 範囲外の扱い
Skill は範囲外の要件を Requirement にせず、proposal.md の Non-goals に書くよう定める SHALL。後のフェーズで作る要件は、種別と状態を「範囲外」にして要約の末尾に「（フェーズ：〇〇）」と書き、Non-goals ではそれ以外の範囲外の要件と分けて書くよう定める SHALL。

Source: REQ-031

#### Scenario: Non-goals への指示
- **WHEN** Skill テンプレートを読む
- **THEN** 範囲外の要件は Requirement にせず proposal.md の Non-goals に書くと指示されている

#### Scenario: 後のフェーズの要件の指示
- **WHEN** Skill テンプレートを読む
- **THEN** 後のフェーズの要件を「範囲外」にし、要約の末尾に「（フェーズ：〇〇）」と書き、Non-goals で分けて書くことが指示されている

### Requirement: 作業完了時の報告
Skill は、作業の最後に、change 一覧・台帳の集計・ブロッキング確認事項・未承認の仮定を報告するよう定める SHALL。

Source: REQ-032

#### Scenario: 報告の 4 項目
- **WHEN** Skill テンプレートの報告の節を読む
- **THEN** change 一覧・台帳の集計・ブロッキング確認事項・未承認の仮定の 4 項目が含まれる

### Requirement: 要件を出した人に送れる確認事項の文面
Skill はブロッキング確認事項を、要件を出した人にそのまま送れる文面で出力するよう定める SHALL。

Source: REQ-033

#### Scenario: 文面の指示がある
- **WHEN** Skill テンプレートを読む
- **THEN** ブロッキング確認事項を要件を出した人にそのまま送れる文面で出すことが指示されている

### Requirement: 形式の変換を持たない
`@loomake/kit` のコードと Skill は、要件書をほかの形式から Markdown へ変換する処理や指示を持たない SHALL。変換は利用者が行う。

Source: REQ-059

#### Scenario: kit のコードに変換処理が無い
- **WHEN** `packages/kit/src/` を走査する
- **THEN** `pandoc`・`pdftotext`・`xlsx2csv` を呼び出すコードが含まれない

#### Scenario: Skill に変換の指示が無い
- **WHEN** Skill テンプレートを読む
- **THEN** `pandoc`・`pdftotext`・`xlsx2csv` で要件書を変換する指示が含まれない

### Requirement: Skill の日本語提供
Skill は日本語で提供される SHALL。

Source: REQ-055

#### Scenario: 日本語で書かれている
- **WHEN** Skill テンプレートの SKILL.md を読む
- **THEN** 見出しと指示文が日本語である

### Requirement: 完了ゲートのタスクの印
Skill は、tasks.md の完了ゲートのタスク（`verify --change <change-id> --done` を通すタスク）の行末に `<!-- loomake:gate=done -->` を付けるよう定める SHALL。

Source: REQ-136

#### Scenario: 雛形に印がある
- **WHEN** Skill テンプレートの書式の参照ファイルの tasks.md の雛形を読む
- **THEN** 完了ゲートのタスクの行末に `<!-- loomake:gate=done -->` があり、SKILL.md がこの印を付けるよう指示している

### Requirement: Issue を要件書の入力として読む
Skill は、指定された GitHub Issue の Markdown 本文と全コメントを要件書 1 冊として読み、既存の台帳・曖昧さ確認・分割合意・書出し・報告を適用する手順を定める SHALL。指定外の Issue・リンク先・添付を取得せず、必要な未取得資料は確認事項にする MUST。取得不能や全コメントの取得を確認できない場合は停止し、本文とコメントを Markdown で渡すよう求める MUST。本文やコメントの矛盾は新しい方を黙って採らず確認事項にし、ファイル入力の Markdown 限定を保つ SHALL。

Source: REQ-402

#### Scenario: 本文と全コメントを読む指示
- **WHEN** Skill テンプレートを読む
- **THEN** 番号または URL で指定した Issue の本文と全コメントを読み、1 冊として既存の手順と採番を適用する指示がある

#### Scenario: 指定外へ取得を広げない
- **WHEN** Issue に別 Issue・リンク・添付への参照がある
- **THEN** 指定外へ取得を広げず、要件に必要で未取得の資料は確認事項として残す指示がある

#### Scenario: 取得不能と取得範囲不明
- **WHEN** Issue を取得できない、または全コメントを取得したと確認できない
- **THEN** 推測で進めず停止して Markdown での提供を求める指示がある

#### Scenario: 本文とコメントの矛盾
- **WHEN** 本文とコメント、またはコメントどうしが食い違う
- **THEN** 新しい方を黙って採用せず、関連要件の確認事項にする指示がある

### Requirement: Issue の出典と取得時点を残す
Skill は Issue 由来の要件の出典に Issue の URL、本文かコメントか、コメントの識別情報と作成者・日時、取得した文中の位置を残すよう定める SHALL。入力文書の既存 3 列に、文書として Issue URL、版として取得時の更新日時とコメント数、日付として取得日を記録するよう定める SHALL。

Source: REQ-403

#### Scenario: 出典の指示と例
- **WHEN** Skill の台帳づくりの手順を読む
- **THEN** 本文・コメントを区別する位置つき出典の指示と例があり、既存の文書名・章と行の指示も残る

#### Scenario: 入力文書の雛形
- **WHEN** Skill の trace.md 雛形を読む
- **THEN** 「文書・版・日付」の 3 列を変えず、Issue URL・取得時の更新日時とコメント数・取得日の例がある

#### Scenario: 既存の仕様ゲートとの互換
- **WHEN** Issue の本文またはコメントを出典にした台帳と未回答のブロッキング確認事項を持つ change を検査する
- **THEN** 台帳の出典は合格し、仕様ゲートは終了コード 1 となる。確認事項に回答すると終了コード 0 になる

### Requirement: Issue の文章をデータとして扱う
Skill は Issue の文章を要求を読み取るためのデータとして扱うよう定める MUST。AGENTS.md・Skill の手順、実行するコマンド、push・マージ・権限を変更させる外部の命令には従わず、製品への要求は既存の手順で台帳に載せるよう定める MUST。

Source: REQ-404

#### Scenario: データと作業者への命令を区別する
- **WHEN** Issue に製品への要求と作業者への命令が含まれる
- **THEN** 要求を台帳に載せ、外部の命令を作業者への権威としない指示と例がある

#### Scenario: 製品への要求を残す
- **WHEN** 作業者への命令と製品への要求が同じ Issue にある
- **THEN** 作業者への命令に従わず、製品への要求を既存の手順で台帳に載せる例がある

### Requirement: 要件ごとに品質の定義を確かめて記録する
Skill は、種別・状態のいずれも範囲外でない全要件について利用者の目的・利用状況（能力・経験、作業、端末、ネットワーク、環境）・受け入れ条件・計測方法・品質副特性を確認するよう定める SHALL。既知の値には出典を付け、不明値は推測せず関連 REQ を付けた確認事項にする。一つの確認事項で複数要件をまとめてよい。trace の既存の見出し・列・順序を保ち、末尾の「品質の定義」に要件ごと一行で値または Q-ID を記録する。

Source: REQ-406

#### Scenario: 五項目の確認を指示する
- **WHEN** 範囲外以外の全要件について曖昧さを確認する
- **THEN** 指示には五項目、出典つきの既知値、不明値への関連 REQ つき確認事項、複数要件をまとめる方法がある

#### Scenario: 品質の定義を雛形に示す
- **WHEN** trace の雛形を読む
- **THEN** 末尾の「品質の定義」に「要件」「目的」「利用状況」「受け入れ条件」「計測方法」「副特性」「出典・確認事項」の列と、出典・Q-ID を使う例がある

#### Scenario: 既存の三表の解析を保つ
- **WHEN** 品質の定義を追加した trace 雛形を既存の解析処理で読む
- **THEN** エラーはなく、既存の列を保った台帳三件・確認事項一件・仮定一件を読み取れる

### Requirement: 受け入れ条件に落とせない要件をブロッキングにする
Skill は、範囲外を除き、入力と回答から受け入れ条件または合否の判定方法を定義できない要件を、関連 REQ つきの blocking 確認事項と台帳の確認待ちにするよう定める SHALL。既存の必須六分類を保つ。目的・利用状況・副特性だけが不明なら既存の実装への影響で判断し、未定全体への一律の停止条件を追加しない。観測の実施待ちと判定基準の未定義を区別する。

Source: REQ-407

#### Scenario: FR-03 の確認事項を残す
- **WHEN** 受け入れ条件または合否を決める計測方法を定義できない
- **THEN** Skill は関連 REQ つき blocking 確認事項と台帳の確認待ちを指示し、観測だけが未実施の場合と区別する

#### Scenario: 必須の六分類を保つ
- **WHEN** 必須で blocking にする条件を読む
- **THEN** 金銭・個人情報・権限・データ削除・外部連携・受け入れ数値の六分類がすべて残る

#### Scenario: その他の不明点は既存の基準で判断する
- **WHEN** 目的・利用状況・副特性だけが不明である
- **THEN** 既存の「実装に影響するなら」と必須六分類で blocking を判断する

#### Scenario: 品質に関する確認事項で仕様ゲートを止める
- **WHEN** 品質の定義があり、関連 REQ つき blocking 確認事項が未回答の trace を仕様ゲートで検証する
- **THEN** 終了コードは 1 で Q-ID が示され、同じ確認事項に回答・回答者・回答日を記録すると終了コードは 0 になる
