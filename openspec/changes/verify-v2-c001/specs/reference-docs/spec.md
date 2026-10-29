## MODIFIED Requirements

### Requirement: 生成ページの導線と既存契約の保持
生成ページはdocs/guide/3.referenceに置き、空でないtitle/descriptionと生成元・再生成方法を持ち、guideの入口からリンクできる SHALL。qualityリファレンスの生成/checkだけでは既存リンク、CLI、quality.yamlの受理/補完、公開8 JSON、公開型/exports、実行時依存、判定を変更しない MUST。この生成処理の影響範囲を、別途承認するCLIリファレンスやC-001の形式移行を禁止する不変条件として扱わない。スキーマの文字列はMarkdown/HTMLの構文として実行されない形で表示する SHALL。qualityリファレンスの生成元2リンクは、掲載先によらず同じソースを参照する完全なGitHub URLを使い、quality.schema.jsonには `https://github.com/loomake/loomake/blob/main/packages/core/schema/quality.schema.json`、quality-schema.tsには `https://github.com/loomake/loomake/blob/main/packages/core/src/quality-schema.ts` を指定する SHALL。

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

#### Scenario: GitHubとサイトでの生成元リンク
- **WHEN** 生成したqualityリファレンスをGitHubの文書ページまたは使い方サイトで読む
- **THEN** quality.schema.jsonとquality-schema.tsの生成元リンクが、それぞれ `https://github.com/loomake/loomake/blob/main/packages/core/schema/quality.schema.json` と `https://github.com/loomake/loomake/blob/main/packages/core/src/quality-schema.ts` を指す。両掲載先を基準に解決しても同じURLとなり、リポジトリ内にある対応する通常ファイルを参照する
