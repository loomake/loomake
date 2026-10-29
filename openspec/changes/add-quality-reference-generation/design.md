# Design: add-quality-reference-generation

## Context

main `8426d8c` では、quality.yamlのversion 2スキーマはcoreにあり、`renderJsonSchemas()` が入力向けの `quality.schema.json` を生成する。既存のcore試験はZod由来の生成内容と保存済みJSONを照合し、NA分岐と既定値も検証している。#60の実装修正は受入済みだが、仕様反映・archiveの最終受入は待ちである。

`docs/guide/3.reference/` には互換性・資源予算・セキュリティの3ページがあり、guide入口はCLIとqualityの全項目を後続の生成ページにすると記している。WBS W6-8/Issue #104のうち、qualityだけを先行する。利用者に届くページの内容は本changeで定め、開発者だけに効く生成・検査の操作手順はADR 0005に沿ってdocs/devへ書く。

## Goals / Non-Goals

全項目をスキーマから導出して、分岐・省略・defaultを失わず表示する。生成済みページの手編集や更新漏れを、既存のテスト実行経路で検出する。製品スキーマ・CLI・公開型・依存は変えない。

CLI共通定義の整理、CLIページ生成、サイトの配置・公開・再ビルドは対象外。metric/sourceの名前空間、任意文字列から読み取れない意味、C-001のv2・scope・証拠採否を推測して書かない。Issue #104全体はCLI生成までopenを維持する。

## Decisions

### 1. 元データは現行の入力JSON Schema

生成スクリプトの案は `scripts/generate-quality-reference.mjs`。Node組み込み機能で `packages/core/schema/quality.schema.json` を読み、rendererへ渡す。保存済みJSONは既存の `renderJsonSchemas()` 一致試験でZodとの対応を保つ。生成時にスキーマファイルやZod定義を変更せず、schema:writeも暗黙には実行しない。

Zod内部構造を新たに走査する案は使わない。公開JSON Schemaに既にtype・required・default・const/enum・制約・oneOfがあり、内部表現への追加依存を避けられるため。元のTSソースからコメントを解析する方法も採らず、descriptionがない項目は「説明未記載」とする。既存descriptionを増やすためのスキーマ変更はこのchangeへ含めない。

### 2. 全構造と分岐の表現

生成ページは `docs/guide/3.reference/4.quality-yaml.md`。固定frontmatterのtitle/description、生成元と再生成方法の注記、項目表を持つ。項目表はパス・型・入力時の必須/任意・default注記・制約・descriptionを表示する。

objectのproperties、recordのadditionalPropertiesとpropertyNames、arrayのitems、oneOfの各分岐を再帰的にたどる。recordのキーは `<id>`、配列要素は `[]` と表記し、IDの正規表現を別の制約として示す。`objectives.<id>` と `product.<id>` はapplicability省略/applicableの分岐とnot_applicableの分岐を別々に記述する。枝ごとのrequiredを保持し、reason/confirmed_byを全枝の必須へまとめない。未知キーを許すadditionalPropertiesと、IDキーを持つrecordの値スキーマも区別する。

現在のスキーマで使うtype、integer、const、enum、minLength、pattern、minimum/exclusiveMinimum等の数値制約とキー制約を表示する。分岐や子項目を黙って落とさないため、未対応の構造を検出したら生成を失敗させる。将来の未対応構造を任意値へ広げて説明しない。

表のdefaultは入力JSON Schemaの注記である。evidenceの親にあるdefault:{}を「補完後も空object」と説明せず、子のartifact_retention等のdefaultも表示する。親evidenceを省略したときの子の補完値は、既存スキーマを最小入力で解析した結果との試験で照合する。任意のdefaults.window等へ独自の既定値を作らない。

### 3. 決定的な生成とcheck

通常実行は対象ページだけを書き出し、`node scripts/generate-quality-reference.mjs --check` は読み取り専用で照合する。スクリプトの場所からリポジトリのパスを解決し、作業ディレクトリで別のファイルへ出力先が変わらないようにする。

出力はUTF-8、LF、末尾改行1つとする。項目の順序は各objectのキーを固定の文字コード順で整え、分岐は入力配列の順序を保つ。時刻・絶対パス・ホスト情報を含めない。checkではCRLFだけをLFへ正規化し、本文・空白・表・既定値などの差は一致扱いにしない。欠落・不一致・読取/生成エラーは非0と日本語の診断で返し、一致時は0とする。checkの失敗でファイルを作成・修復しない。

rendererと照合処理はnamed exportにし、テストからfixtureと一時ディレクトリを渡せるよう分ける。これは開発スクリプト内部の分割であり、製品のexportsへ追加しない。Markdownの縦棒・バッククォート・改行・HTML記号を文字としてエスケープし、descriptionや値で表を崩さない。

### 4. 検証とCIへの接続

新しいID付き試験を `tests/quality-reference.test.ts` に置く案とする。実スキーマの全パス・条件付き必須・defaultの代表例を期待値として確認し、小さい制御用schemaでも配列・record・分岐と特殊文字を検証する。実際の文書を改変せず、一時ディレクトリで生成物の欠落・改変・一致・CRLF・繰り返し生成を試す。

保存済みページと実スキーマから再生成した文字列の一致を同じテストで検査する。これにより既存のpnpm test、完了ゲートとCIで検査され、文書だけのPRでもgate側のテスト実行に載る。新しいCIジョブや既存のskip条件は追加・変更しない。既存のcore JSON Schema生成一致試験とdoc-links試験も維持する。スキーマだけを変えた場合はJSON一致検査、JSONとスキーマを更新してページを残した場合はリファレンス一致検査が失敗する。

### 5. 文書導線と互換性

guide入口から新ページへリンクし、CLI生成の予定は後続として残す。既存3ページの番号・内容・リンクは移動しない。生成手順は `docs/dev/reference-generation.md` へ書き、schema変更時は既存のschema:writeを実行してからページを再生成し、checkと関連試験を通す順序を記す。

公開8 JSON、quality version 2、VerifyResult 1.0.0、型・exports・実行時依存とパッケージのfilesを変えない。変更はrepoの文書と開発スクリプトなので、パッケージの版変更を伴わない空のchangesetを実装時に用意する。公開サイトへの反映操作や公開・リリースは行わない。

## Risks / Trade-offs

- 入力JSON Schemaのdefault注記を実際の補完結果と取り違える → 親と子の注記を分け、既存スキーマの解析結果で省略時を照合する。
- unionを1表へまとめて条件付き必須を失う → 枝ごとのrequiredと条件を残す。
- 保存済みJSONがTSスキーマから古くなる → 既存のcore一致検査を維持し、新しい一致検査と両方を実行する。
- description不足を推測で埋める → 未記載と表示し、metric/sourceや未実装機能の説明を増やさない。

## Migration Plan

#60の仕様反映・archiveの最終受入と仕様ゲート成功を確認してから、別のapply作業へ進む。このターンは計画で止める。実装ではrendererと直接試験、生成/checkと差分試験、ページと導線・開発手順の順にまとめ、通常の完了ゲートと独立レビューを確認する。Issue #104全体はCLI側の残作業を明記してopenを維持する。
