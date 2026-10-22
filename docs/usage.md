# Loomake の使い方

Loomake を自分のプロジェクトに入れて、要件書から AI に実装させるまでの手順をまとめる。このリポジトリ自身を開発する手順は [flow.md](flow.md) にある。

## 1. Loomake がすること

AI に要件書を渡して実装させると、曖昧な点が推測で埋められ、どの要件をどのテストで確かめたかも追えなくなる。Loomake は [OpenSpec](https://github.com/Fission-AI/OpenSpec) の上で、次の 3 つを受け持つ。

| 道具 | 役割 |
|---|---|
| req-to-openspec Skill | 要件書を、出典つきの OpenSpec change（proposal・specs・tasks・trace）に変える |
| AGENTS.md | AI が従う共通ルール（仕様の正、作業の流れ、完了の定義、禁止事項、報告の形） |
| `loomake verify` | 仕様ゲート（実装に入ってよいか）と完了ゲート（要件ごとにテストがあるか）を機械的に確かめる |

1 つの change は次の順に進む。人がするのは、確認事項への回答と PR のレビューが中心になる。

```
要件書（Markdown） → change を作る → 確認事項に答える → 仕様ゲート → 実装 → 完了ゲート → PR → archive
```

## 2. 必要なもの

- Node.js 20.19 以上
- [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec)（`npm install -g @fission-ai/openspec`）
- Skill を読める AI エージェント（Claude Code または Codex）
- 要件書は Markdown（.md）で用意する。Word・Excel・PDF の要件書は、先に Markdown に変換しておく。Skill は Markdown 以外の要件書を読まずに、変換を求める

## 3. 導入する

プロジェクトのルートで実行する。

```sh
npx loomake init
```

> `loomake` はまだ npm に公開していない。公開するまでは、このリポジトリで `pnpm build` したあと、`node <このリポジトリ>/packages/cli/dist/cli.js init` で同じことができる。

次のファイルが置かれる。

| ファイル | 中身 |
|---|---|
| `AGENTS.md` | AI が従う共通ルール。末尾の「プロジェクト固有の情報」は自分のプロジェクトに合わせて書き換える |
| `CLAUDE.md` | `@AGENTS.md` だけ。Claude Code に AGENTS.md を読ませる |
| `loomake.config.json` | verify の設定（[6 章](#6-設定loomakeconfigjson)） |
| `.claude/skills/req-to-openspec/` | req-to-openspec Skill |

次のオプションがある。

| オプション | すること |
|---|---|
| `--codex` | Skill を `.agents/skills/req-to-openspec/` にも置く（Codex 用） |
| `--devcontainer` | `.devcontainer/devcontainer.json`（Node 24・Claude Code・OpenSpec CLI）を置く |

`loomake.config.json` の品質コマンドは package.json の `packageManager`（なければロックファイル）から pnpm・npm・yarn を判定して決まる。どれも分からなければ npm になる。

### 既にファイルがあるとき

- 同じ名前で内容の違うファイルがあると、差分を表示して「上書きしますか [y/N]」と聞く。Enter だけなら上書きしない
- 内容が同じファイルは、聞かずにそのままにする（改行コードだけの違いは同じとみなす）
- CI やパイプなど、確認に答えられない環境で内容の違うファイルがあると、差分を表示し、何も置かずに終了コード 1 で止まる。端末から実行し直す

テンプレートが新しくなったときも、`loomake init` をもう一度実行すれば差分を見ながら更新できる。

### 導入のあとにすること

1. `openspec/` が無ければ `openspec init` を実行する（init が案内する）
2. テストランナーが結果を JSON で `.loomake/test-report.json` に書き出すよう設定する。verify はこのファイルで、要件ごとのテストを確かめる

   Vitest では `vitest.config.ts` に書く。

   ```ts
   export default defineConfig({
     test: { reporters: ['default', 'json'], outputFile: { json: '.loomake/test-report.json' } },
   });
   ```

   Jest では package.json の test スクリプトに書く。

   ```sh
   jest --json --outputFile=.loomake/test-report.json
   ```

3. `.loomake/` を `.gitignore` に入れる
4. `AGENTS.md` の末尾の「プロジェクト固有の情報」を書き換える

## 4. 1 つの change を進める

### 4.1 要件書を change にする

要件書を版を含む名前でリポジトリに置き（例：`docs/requirements/order-v1.0.md`）、AI エージェントに頼む。

```
req-to-openspec スキルで docs/requirements/order-v1.0.md を change にして
```

Skill は次の順に進める。

1. 要求を述べている文を 1 文ずつ `REQ-001` から採番し、出典（文書名・章と行）つきで要件台帳に載せる
2. 曖昧さのチェックリストを全要件にあて、確認事項（Q）か仮定（A）として記録する。お金・個人情報・権限・データ削除・外部連携・検収数値に関わる曖昧さは、仮定にせず、必ずブロッキングな確認事項にする
3. change の分割案（リリース・検収の単位）を示す。**人が合意するまで書き出さない**
4. `openspec/changes/<change-id>/` に proposal.md・specs・tasks.md・trace.md を書く
5. change 一覧、台帳の集計、ブロッキング確認事項、未承認の仮定を報告する。ブロッキング確認事項は顧客にそのまま送れる文面で出る

### 4.2 確認事項に答え、仕様ゲートを通す

`trace.md` を開き、確認事項の「回答」欄と、仮定の「承認」欄を埋める。顧客に聞くものは、Skill が出した文面を送って回答をもらう。

```sh
npx loomake verify --change <change-id> --spec-only
```

| 結果 | 意味 |
|---|---|
| 合格（終了コード 0） | 実装に入ってよい。未承認の仮定と確認待ちの要件は警告として出るが、止まらない |
| 不合格（終了コード 1） | 未回答のブロッキング確認事項や、仕様の不備がある。詳細に沿って直し、もう一度実行する |

回答で仕様が変わるときは、AI に頼んで spec.md と tasks.md にも反映させる。

### 4.3 実装する

change-id と同じ名前のブランチを切り、AI に頼む。

```
openspec/changes/<change-id> の tasks.md を順に実装して。AGENTS.md に従って、タスクごとにコミット。
```

AGENTS.md の決まりにより、AI は次のように動く。

- 仕様に無い振る舞いが必要になると、止まって質問する。答えるか、仕様を直すかを選ぶ
- テストを弱める、skip する、設定を緩めるといった変更は、人の承認なしにはしない
- テスト名に要件 ID を入れる：`it('[REQ-012] 未ログインのとき 401 を返す', ...)`。1 つのテストで複数の要件を確かめるときは `[REQ-012][REQ-013]` と並べる。`describe` の名前に入れてもよい

### 4.4 完了ゲートを通して PR を出す

```sh
npx loomake verify --change <change-id> --done
```

仕様ゲートの検査に加えて、次を確かめる。

- tasks.md のタスクがすべてチェック済み
- 確認待ちの要件が残っていない
- `loomake.config.json` の品質コマンド（lint・typecheck・test）がすべて成功する
- 仕様で参照されている要件 ID ごとに、名前にその ID を含むテストが 1 つ以上あり、実際に成功している。skip したテストや、実行されなかったテストは数えない

合格したら PR を出す。

### 4.5 マージしたら archive する

```sh
openspec archive <change-id>
git add -A openspec
git commit -m "archive: <change-id>"
```

差分仕様が `openspec/specs/`（いまの仕様）に取り込まれ、change は `openspec/changes/archive/` に移る。新しい capability ができたときは、`openspec/specs/<capability>/spec.md` の `## Purpose` が仮の文（`TBD - …`）になるので書き換える。それ以外で `openspec/specs/` を直接編集してはいけない。

## 5. `loomake verify` のリファレンス

```
loomake verify [--change <id> (--spec-only | --done)] [--json] [--skip-commands]
```

| オプション | 意味 |
|---|---|
| `--change <id> --spec-only` | 仕様ゲート |
| `--change <id> --done` | 完了ゲート |
| （`--change` なし） | 品質コマンドだけを実行する |
| `--json` | 結果を JSON で標準出力に出す。進捗は標準エラーに出る |
| `--skip-commands` | 品質コマンドを実行しない。前に書き出したテストのレポートで判定する |

終了コードは、すべて合格か警告なら 0、1 つでも不合格なら 1、使い方や設定の誤りなら 2。

### 検査の一覧

| 検査 | 仕様ゲート | 完了ゲート |
|---|---|---|
| change・proposal.md・tasks.md・trace.md の存在 | ✓ | ✓ |
| `openspec validate --strict` | ✓ | ✓ |
| 要件台帳（台帳の出典、状態値） | ✓ | ✓ |
| ブロッキング確認事項に回答がある | ✓ | ✓ |
| 差分仕様、Requirement の Source、Source が台帳にある、Scenario がある | ✓ | ✓ |
| 反映済の要件が仕様にある | ✓ | ✓ |
| 仮定の承認、確認待ちの要件 | 警告 | 警告 |
| 確認待ちが残っていない |  | ✓ |
| tasks.md がすべてチェック済み |  | ✓ |
| 品質コマンド（`command: lint` など） |  | ✓ |
| 要件ごとのテスト |  | ✓ |

### JSON 出力

`--json` の出力は `@loomake/core` の [verify-result.schema.json](../packages/core/schema/verify-result.schema.json)（`schemaVersion` 1.0.0）に従う。

```json
{
  "schemaVersion": "1.0.0",
  "mode": "done",
  "change": "add-order-export",
  "ok": true,
  "results": [{ "check": "tasks.md", "status": "pass", "detail": "" }],
  "coverage": { "REQ-012": ["tests/order.test.ts"] }
}
```

`status` は `pass`・`fail`・`warn`・`skip` のどれか。`coverage` は完了ゲートのときだけ出る。

### CI で使う

PR ごとに完了ゲートを実行すると、ゲートを通っていない change をマージしにくくなる。GitHub Actions では、たとえば次のように書く。

```yaml
- run: npm ci
- run: npm install -g @fission-ai/openspec
- run: npx loomake verify --change "${{ github.head_ref }}" --done
```

ブランチ名と change-id をそろえておくと、このように PR のブランチ名をそのまま渡せる。change ではないブランチ（依存の更新など）では「change の存在」で不合格になるので、`openspec/changes/<ブランチ名>/` が無いときは `--change` を付けずに実行し、品質コマンドだけを確かめる。リポジトリの設定で、このジョブを必須のチェックにする。

## 6. 設定（loomake.config.json）

```json
{
  "$comment": "Loomake の検証設定。AI は人の承認なしにここを緩めないこと（AGENTS.md 4章）",
  "openspecDir": "openspec",
  "openspecValidate": "auto",
  "tests": { "report": ".loomake/test-report.json" },
  "commands": { "lint": "npm run lint", "typecheck": "npm run typecheck", "test": "npm test" }
}
```

| キー | 既定値 | 意味 |
|---|---|---|
| `openspecDir` | `openspec` | OpenSpec のディレクトリ |
| `openspecValidate` | `auto` | `openspec validate --strict` の扱い。`auto` は OpenSpec CLI が無ければ警告、`true` は CLI が無ければ不合格、`false` は実行しない |
| `tests.report` | `.loomake/test-report.json` | テストランナーが書き出す JSON レポート。完了ゲートは、品質コマンドを実行する前にこのファイルを消す |
| `commands` | なし | 完了ゲートで実行する品質コマンド。lint・typecheck・test の順に実行し、ほかの名前はそのあとに実行する。値を空か `null` にすると実行しない |

## 7. trace.md の読み方

trace.md は change ごとの要件の出典と合意の記録で、verify が読む。表の列の順番と見出し名は変えない。

| 表 | 中身 | 人がすること |
|---|---|---|
| 要件台帳 | 要件 ID・出典・種別・要約・状態・反映先 | 状態が正しいかを見る |
| 確認事項 | 質問・選択肢・おすすめ・ブロッキングか | 「回答」欄を埋める |
| 仮定 | 要件書に無いことを仮に決めた内容と理由 | よければ「承認」欄を埋める |

台帳の状態は `反映済`・`確認待ち`・`範囲外`・`既存仕様で充足` のどれか。`確認待ち` が残っていると、完了ゲートは不合格になる。

## 8. よくあるつまずき

| 症状 | 原因と対処 |
|---|---|
| 完了ゲートで「テストのレポート（.loomake/test-report.json）がありません」 | テストランナーが JSON レポートを書き出していない。[3 章](#導入のあとにすること)の設定をする |
| 「テストが無い要件：REQ-012」 | 名前に `[REQ-012]` を含むテストが無いか、skip されているか、失敗している |
| `openspec validate` が警告になる | OpenSpec CLI が入っていない。入れるか、`openspecValidate` を `false` にする |
| `loomake init` が終了コード 1 で止まる | 確認に答えられない環境で、内容の違うファイルがあった。端末から実行し直す |
