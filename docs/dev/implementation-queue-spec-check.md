# 実装キューへ入れた時点の仕様確認例

Issue #286の項目1について、次の3案からBを選びました。

| 案 | 内容 | 判断 |
|---|---|---|
| A | doctorに静的な注意を出す機能を加える | 今回は採らない |
| B | キュー投入時の仕様ゲートを確認するCIの例を文書に置く | おすすめ。doctorのオフライン契約を保てるため採用 |
| C | 既存のPR検査と運用規則で対応する | 今回は採らない |

出典は[本人のQ-286-01=B回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404)と[元の選択肢・条件](https://github.com/loomake/loomake/issues/121#issuecomment-6576621797)です。この文書の追加では、Loomakeの製品や実際のworkflowを変更していません。

以下は、pnpmとLoomakeを導入済みのリポジトリ向けの例です。Issue本文に、確認するchangeを1本だけ明示します。自由文からchangeを推測しません。

```text
loomake-change: example-change
```

例を使う場合は既定ブランチにworkflowを配置します。[GitHubのissuesイベント](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues)の`GITHUB_SHA`は既定ブランチのコミットです。そのイベントのSHAを記録し、checkoutにも同じ値を渡します。実装ブランチの最新状態や、mainが動いたあとの状態を検査する例ではありません。

```yaml
name: queue-spec-example
on:
  issues:
    types: [labeled]
permissions:
  contents: read
jobs:
  spec:
    if: github.event.label.name == 'implementation-queue'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          ref: ${{ github.sha }}
          persist-credentials: false
      - name: 対象を記録する
        shell: bash
        run: |
          node --input-type=module <<'JS'
          import { readFileSync, appendFileSync } from 'node:fs';
          const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
          const lines = (event.issue.body ?? '').split(/\r?\n/);
          const declarations = lines.filter(line => /^loomake-change:/.test(line));
          const id = declarations[0]?.slice('loomake-change:'.length).trim();
          if (declarations.length !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id ?? '') || id === 'archive') {
            throw new Error('Issue本文にloomake-change: <change-id>を1行だけ書いてください');
          }
          const record = `Issue #${event.issue.number}: ${id}, SHA=${process.env.GITHUB_SHA}\n`;
          console.log(record);
          appendFileSync(process.env.GITHUB_STEP_SUMMARY, record);
          appendFileSync(process.env.GITHUB_ENV, `CHANGE_ID=${id}\n`);
          JS
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: 仕様ゲートを確かめる
        shell: bash
        run: |
          set +e
          pnpm exec loomake verify --change "$CHANGE_ID" --spec-only --json > queue-spec.json
          verify_exit=$?
          set -e
          cat queue-spec.json
          test "$verify_exit" -eq 0
          node --input-type=module <<'JS'
          import { readFileSync } from 'node:fs';
          const r = JSON.parse(readFileSync('queue-spec.json', 'utf8'));
          if (r.schemaVersion !== '2.0.0' || r.change !== process.env.CHANGE_ID ||
              r.run?.status !== 'completed' || !Array.isArray(r.run.errors) || r.run.errors.length ||
              r.decision?.required !== false ||
              !Array.isArray(r.checks) || !r.checks.length ||
              r.checks.some(c => !['PASS', 'NOT_APPLICABLE'].includes(c.result)) ||
              !r.checks.some(c => c.result === 'PASS')) {
            throw new Error('仕様ゲートの成功を確認できません');
          }
          JS
```

この例のspec-only（既定のscope local）のJSONには`verdict`がありません。終了コードと、検査の完了・要判断なし・各検査の結果で成功を確かめます。

権限は`contents: read`だけです。対象がない・未回答がある・コマンドが失敗した・JSONを取得できない場合はjobが失敗します。Issueやラベルを書き換えず、不合格でもラベルを付ける操作自体は防ぎません。

起動するのはラベル付与時だけです。mainの更新やIssue本文の編集では再検査せず、継続的な最新状態を保証しません。実装前の仕様ゲート、実装後の完了ゲート、PRの必須CIを置き換えません。この文書例の受入を、実際のキュー検査が稼働した証拠には数えません。
