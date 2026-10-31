# guide の補足抜粋

元コミット `77aabfb98bff8e90938732bbeb8da2dda8faa5c4` の git show から取得。内容は抜粋内で変更していない。

## docs/guide/2.guides/1.for-agents.md:85-97

```markdown

   要件 ID は `specs/<capability>/spec.md` の各 Requirement にある `Source: REQ-xxx` 行で分かる

4. 完了ゲートを通す

   ```sh
   npx loomake verify --change <change-id> --done
   ```

5. 合格したら、`AGENTS.md` の「報告の形」で報告する

<a id="guide-fix-verify-failure" name="guide-fix-verify-failure"></a>

```

## docs/guide/2.guides/1.for-agents.md:158-167

```markdown

```
openspec/changes/add-order-export の tasks.md を順に実装して。AGENTS.md に従って、タスクごとにコミット。
```

```
npx loomake verify --change add-order-export --done を通して。落ちた検査は、出力の詳細に沿って直して。テストと設定は緩めないで。
```

この文書は Loomake のリポジトリにあり、`loomake init` は利用者のプロジェクトに置かない。エージェントに読ませるときは、この文書の URL を渡す。
```

## docs/guide/1.getting-started/2.usage.md:205-220

```markdown
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
```

## docs/guide/1.getting-started/1.quickstart.md:59-74

```markdown
| 手順 | 誰が | すること |
|---|---|---|
| ① change を作る | AI | 「req-to-openspec スキルで docs/requirements/order-v1.0.md を change にして」と頼む。分割案に合意すると `openspec/changes/<change-id>/` ができる |
| ② 確認事項に答える | 人 | `trace.md` の確認事項に回答を、仮定に承認を書く（回答者・承認者と日付も） |
| ③ 仕様ゲート | verify | `npx loomake verify --change <change-id> --spec-only` が合格するまで②に戻る |
| ④ 実装する | AI | change-id と同じ名前のブランチで「tasks.md を順に実装して。タスクごとにコミット」と頼む |
| ⑤ 完了ゲート | verify | `npx loomake verify --change <change-id> --done` が合格するまで④に戻る |
| ⑥ PR とマージ | 人 | PR をレビューしてマージする |
| ⑦ archive | 人 | `openspec archive <change-id>` を実行してコミットする |

④と⑤は `npx loomake run --change <change-id>` で AI に任せられる。run は完了ゲートが通るまで直させ、証拠を記録して PR を作る。初めは `--dry-run` で、渡すタスクと指示を確かめる。

## 3. テスト名の決まり

完了ゲートは要件 ID を名前に含む**成功した**テストがあるかを、要件ごとに確かめる。skip したテストや失敗したテストは数えない。

```
