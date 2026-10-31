# 3 つの OS でのテストの前提

リポジトリのテストとテスト用のスクリプトは、ubuntu-latest・macos-latest・windows-latest で同じ期待値を使う。OS の違いは、期待値を変えず、skip もせずに、テストの準備と読み方で吸収する。

この決まりは以前、monorepo の仕様の Requirement「OS によらないテストの前提」（REQ-236）と「外部操作の期限の試験の偽の CLI」（REQ-240）だった。change move-dev-mechanics-to-docs で仕様から外した。

## テストの準備と読み方

- 行の正規表現で読むファイルは、改行を LF にそろえてから読む。Windows では、ワークフローの YAML が CRLF で取り出されることがある。`.gitattributes` で改行を固定することはしない
- リンク先のないシンボリックリンクを `.git/hooks` に置くときは、git がフックとして実行しない名前にする。テストの準備のコミットが、そのリンクで止まらないようにするため
- Windows でシェルから起動するとき、固定の裸のコマンド名 `pnpm`・`npm` は引用符で囲まない。空白を含みうる実行パス（`.cmd` で終わるものを含む）と引数は囲む
- 準備の時間が OS で変わる非同期の待ちには、待ち時間を明示する。たとえば二重起動の試験は、明示した待ち時間のうちに先の実行のエンジンの起動を待ってから、二重起動を試す

この前提を使う試験には、次のものがある。

- `tests/release-security.test.ts`（公開経路の権限と CodeQL のワークフロー）
- `tests/package-artifacts.test.ts`、`tests/ai-journeys.test.ts`（配布物の準備のコマンド）
- `packages/runner/test/guards.test.ts` の「リンク先のないフックがあっても、落ちずにタスクを完了にする」
- `packages/runner/test/run.test.ts` の「二重起動は先の実行を変更せず、中断後はロックを解放する」

## 外部操作の期限の試験の偽の CLI

外部操作の期限を確かめる試験（`packages/runner/test/external-budget.test.ts` と、実時間の期限まで待つ試験を分けた `packages/runner/test/external-budget-deadline.test.ts`）は、どの OS でも、偽の CLI（git・gh・OpenSpec CLI）を製品と同じ起動の仕方で呼ばせる。git は shell なしで、gh と OpenSpec CLI は Windows では shell 経由で起動する。偽の CLI は `packages/runner/test/helpers.ts` が作る。

- 試験は偽の CLI が狙った操作で止まった印と、それより前の本物への転送が起動に失敗していないことを、先に確かめる。そのあとで、期限・終了コード・停止の理由・後続の処理を確かめる。偽の git が呼ばれずに本物の git が動いたときは、狙った段階に届いていないとして失敗させ、期限と終了コードだけで合格にしない
- 準備の外部操作だけで共有予算を使い切り、狙った操作に届かないときも、合格にしない
- 予算を延ばした試験は、1 操作の期限または共有予算より長く待ったことと、期限に猶予を足した時間のうちに止まったことを確かめる

外部操作の期限そのもの（run・verify・trace が守る期限と終了コード）は、製品の振る舞いなので、run と external-process-budget などの仕様に残っている。
