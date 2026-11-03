## MODIFIED Requirements

### Requirement: 既存PRを確認した上での再試行
push後に同じリポジトリの同じbase/headのopen PRを検索する SHALL。一意に存在する場合は新規作成せず、既存のURLを表示して終了コード0で終える SHALL。既存PRがDraftかどうかによらず状態を変えない SHALL。存在しない場合だけ作成する SHALL。検索失敗・不正な結果・複数の候補では新規作成せず、理由を記録して終了コード1で止まる SHALL。PRのURLは認証情報を含まないHTTPSのpullリクエストURLとして検証する SHALL。

Source: REQ-165

#### Scenario: 作成の応答だけが失われた
- **WHEN** 前回の作成でPRが作られたが失敗として終了し、そのまま再実行する
- **THEN** 既存PRを見つけ、PRを重複作成せず完了する

#### Scenario: PR検索の結果を判断できない
- **WHEN** 検索が失敗するか、結果が壊れているか、一意に決まらない
- **THEN** 新規作成へ進まず、証拠を保って停止する


#### Scenario: 既存PRの状態を変えない
- **WHEN** 同じbase/headのopen PRがDraftまたはReadyで一意に存在する
- **THEN** 新規作成や状態変更をせず、既存URLを表示して終了コード0で終える
