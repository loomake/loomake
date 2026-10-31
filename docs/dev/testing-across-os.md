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


## フック試験の外部操作をローカルで診断する

`external-budget-deadline.test.ts` は、`LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` を指定したときだけ外部操作の観測を保存する。保存先を `<診断先>/processes` にして、次の試験を1回実行する。元の期限・期待値・通常CIの選択は変えない。

```sh
pnpm exec vitest run --project unit packages/runner/test/external-budget-deadline.test.ts -t 'pre-commit・pre-push のフックがあっても'
node scripts/external-call-diagnostics.mjs <診断先>/processes .loomake/test-report.json
```

集計は `<診断先>/summary.json` と `summary.md` を作る。最後のgh操作と上限で停止した操作について、入口の共有残予算、監視役に渡した絶対deadline、終了kind、欠けた欄を同じcall IDで確認できる。内部timeoutの厳密な値は取得せずnullとし、観測時刻から求めた区間と区別する。共有期限と1操作の上限が近い場合や観測が欠けた場合は、原因を未確定として扱う。診断ファイルごとに64KiBの上限を設け、上限到達と読めない行も集計する。

観測では、元の関数を同じ引数で一度だけ呼び、返値とthrowをそのまま返す。生の引数・環境値・出力・例外messageは記録しない。保存に失敗しても元の試験結果を変えないが、観測のI/Oとpreloadは実行時間や失敗頻度に影響しうる。単独実行の成功を、mainの並行実行での失敗の再現や修理完了とは扱わない。


CIの`diagnose-hook-budget`は、関連PRと手動起動で同じ1件を実行する。手動起動はworkflowをdefault branchへ取り込んだあとに使える。通常CIの試験範囲や期限は変えず、試験が失敗すればjobも失敗のままになる。

公開artifactには、専用export先の`calls.jsonl`・`summary.json`・`summary.md`・`heartbeat.json`だけを個別に指定し、7日間保存する。exportではcall IDを固定連番へ置き換え、許可したキー・列挙値・有限数・nullだけへ再投影してschemaを検査する。元のPID・生レポート・preload・一時ディレクトリ全体はアップロード対象に含めない。選択が1件でなければ集計を失敗にし、schema検査済みの診断がある場合だけartifactへ保存する。Step Summaryも検査済みの要約だけを使う。
