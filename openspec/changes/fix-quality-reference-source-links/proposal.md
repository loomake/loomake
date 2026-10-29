# Proposal

## Why

quality.yamlリファレンスの生成元2リンクはGitHubではソースのURLへ解決されるが、使い方サイトでは同じサイトの `/packages/` 以下へ解決される。生成元を調べられるように、掲載先に依存しないGitHubの完全なURLへ変える案をレビューできる形にする。

## What Changes

- REQ-322の既存本文と3 Scenarioを保持し、掲載先に依存しない完全な生成元URLの要件文と、GitHubとサイトで同じ生成元を参照するScenarioを足す。
- rendererの生成元2リンクを `https://github.com/loomake/loomake/blob/main/packages/` 以下へ変え、qualityリファレンスを再生成する案とする。
- 2リンクのラベルとhrefの完全一致・各1回・ソースファイルの実在・GitHubとサイトを基準にした解決結果を確認する回帰試験を計画する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `reference-docs`: REQ-322の生成元リンクについて、掲載先を変えても同じ生成元を指すことを明記する。

## Impact

実装対象の案は `scripts/quality-reference.mjs`、生成ページ `docs/guide/3.reference/4.quality-yaml.md` と `tests/quality-reference.test.ts`。表の内容、title/description、再生成方法、他の文書導線、REQ-320/321、製品CLI・スキーマ・実行時依存・品質設定は保持する。siteのコード・担当・公開操作と、C-001は含めない。

## 人の判断が必要な項目

T-URL-01は未回答であり、AGENTS.md 4章に基づいて実装開始を止める。既存試験の変更対象は次の1 assertionだけとする。

```ts
// 変更前
expect(page).toContain('../../../packages/core/schema/quality.schema.json');
// 変更後の案
expect(page).toContain('https://github.com/loomake/loomake/blob/main/packages/core/schema/quality.schema.json');
```

Aはこの置換と上の追加検査を承認する。Bは承認せず現状を保持して別案を検討する。おすすめはA。GitHubでは現在と同じソースURLを保ち、サイトでの誤解決を直し、2 hrefの検査を追加するためである。既存の `docs/guide/3.reference/1.compatibility.md` も同じ `blob/main` の完全なURLを使っている。回答はtraceの同IDへ承認元とともに記録する。この提案では採否を決めず、renderer・生成ページ・試験は編集しない。
