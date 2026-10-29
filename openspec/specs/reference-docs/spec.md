# reference-docs Specification

## Purpose

利用者がquality.yamlの現行の設定項目と制約を調べられるように、スキーマからリファレンスを生成する契約を定める。手書きの項目一覧に依存せず、全階層・条件付き必須・既定値と、再生成時の一致を保つ。

## Requirements

### Requirement: quality.yamlの全構造のリファレンス
quality.yamlのリファレンスは、coreの現行スキーマを元に生成する SHALL。トップレベル、objectの子、IDをキーにするrecordの値、配列要素と各分岐の全項目を含め、パス・型・必須/任意・条件付き必須・既定値・enum/const・数値/文字列/キーの制約・既存descriptionを表示する MUST。NA分岐を区別し、スキーマにない既定値やmetric/sourceの解釈を追加しない MUST。説明がない項目は未記載と示す SHALL。

Source: REQ-320

#### Scenario: 全階層と制約
- **WHEN** 現行のqualityスキーマからリファレンスを生成する
- **THEN** version/model、defaults、report、objectivesとproductの項目・evidence/indicators配列、automation、証跡保管方針の全階層と、IDキー・期間・target・数値の制約を含む

#### Scenario: 対象外の条件付き必須
- **WHEN** objectivesとproductのapplicable分岐とnot_applicable分岐を生成する
- **THEN** characteristicの共通必須と、NAのときだけreason/confirmed_byが必須になる条件を区別し、任意項目を無条件の必須にしない

#### Scenario: 入力省略と補完
- **WHEN** evidence/indicatorsの空配列、objectives/productの空object、証跡保管方針の既定値を表示する
- **THEN** 入力時の省略可否とdefault注記を区別し、証跡保管方針の親を省略したとき子の既定値が適用されることを示す。defaultのない任意項目へ値を補わない

### Requirement: 再生成一致と読み取り専用の検査
同じスキーマからは同じリファレンスを生成する SHALL。生成物に時刻・実行環境固有のパスを入れず、順序を安定させる MUST。checkモードは生成物と期待内容を照合し、一致時は0、欠落・改変・読取/生成失敗時は非0で終了する SHALL。checkモードで生成物を作成・上書きしてはならない MUST NOT。CIでも再生成不一致を失敗として検出する MUST。

Source: REQ-321

#### Scenario: 同じ入力と差分なし
- **WHEN** 同じ入力で生成を繰り返し、checkモードで照合する
- **THEN** 出力は同一になり、checkは0で終了する。checkout時のLF/CRLFの違いだけは同一内容と扱う

#### Scenario: 欠落と改変
- **WHEN** 生成物がない、または1項目・既定値・分岐の説明を改変してcheckを実行する
- **THEN** 非0となり対象ファイルと再生成方法を示す。欠落ファイルを作成せず、改変内容を上書きしない

#### Scenario: スキーマとのずれ
- **WHEN** スキーマの項目・制約・既定値・分岐を変更して生成物を更新しない
- **THEN** 既存のスキーマ生成一致検査とリファレンス一致検査によりCIが失敗し、古い説明を正しいものとして通さない

### Requirement: 生成ページの導線と既存契約の保持
生成ページはdocs/guide/3.referenceに置き、空でないtitle/descriptionと生成元・再生成方法を持ち、guideの入口からリンクできる SHALL。既存のリファレンスとリンクを保持し、CLI・quality.yamlの受理/補完・公開8 JSON・公開型/exports・実行時依存・判定を変更しない MUST。CLIリファレンス生成とC-001の未決契約は本範囲へ含めない MUST。スキーマの文字列はMarkdown/HTMLの構文として実行されない形で表示する SHALL。

Source: REQ-322

#### Scenario: 入口と既存ページ
- **WHEN** guideの入口と生成ページを読む
- **THEN** qualityリファレンスへ到達でき、既存の互換性・資源予算・セキュリティのページへのリンクも残る。生成ページのtitle/descriptionは空でない

#### Scenario: 生成の影響範囲
- **WHEN** リファレンスの生成またはcheckを実行する
- **THEN** 生成対象以外の既存文書・公開JSON・製品ファイルを変更しない。metric/sourceを現行の文字列制約以上に制限した説明や、未実装のv2契約を生成しない

#### Scenario: 文字列の表示
- **WHEN** スキーマのdescriptionや値にMarkdownの区切り・改行・HTML記号が含まれる
- **THEN** 表の列や構造を壊さず、元の文字列として読める形で表示する
