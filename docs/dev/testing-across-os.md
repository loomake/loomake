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

集計は `<診断先>/summary.json` と `summary.md` を作る。版2の要約では最後のgh操作と上限で停止した操作について、観測開始時の共有残予算、監視役に渡した絶対deadline、終了kindを同じcall IDで確認できる。Markdownは「同時上限の可能性」「理由」「欠損」を別の列に示す。可能性がyesなら、1操作上限や明示timeoutが共有期限の窓と重なり得るため、原因を断定しない。内部timeoutの厳密な値は取得せずnullとし、観測した区間と区別する。

spawn直前の時刻をts、共有残予算を読んだ直後をt1、保持役の累積待ちをhw0・hw1とする。共有期限の窓は未観測の遅れの上限 `max(0, ts−t1−(hw1−hw0))` に1msを足した分だけ前へ、後ろへは1ms広げる。元の観測順序 `ts<t1` は窓の許容差と独立に拒否し、保持役待ちを差し引いた `ts−t1−(hw1−hw0)<−1` の不整合判定も保つ。明示timeoutのないnormal操作で、この窓より十分前のdeadlineだけを1操作上限と分類する。時計の欠損・逆転や観測の不整合は未確定とする。`timeoutRequested` は指定の有無だけを示し、値は保存しない。旧rawの欠落、getterやProxy、継承した設定はnull（不明）とし、timeoutのgetterを追加評価しない。

設定のsnapshotは診断envの確認直後、予算時計t0を読む前に一度だけ取る。元関数を呼んだあとの設定は読まない。製品がqualityCommand・untilDeadline・timeoutMsの順に設定を読むことを前提とし、3項目すべてが安全な自身のデータ値か指定なしと分かるときだけ、timeoutの有無をtrue/falseにする。どれかにgetter・Proxy・不明な継承があればnullとする。これにより、先行するqualityCommandのgetterがtimeoutを書き換える場合も、値を推測せず追加評価を避ける。qualityCommandがtrueで元の処理がuntilDeadlineを読まない場合も、3項目を安全に判定できることを条件にする。

modeはqualityCommandとuntilDeadlineを同じ方法で求め、不明ならnullとする。作業ディレクトリも安全に得られた自身の文字列だけを使い、不明なら由来を示すrepo欄を省く。timeoutの値そのものや作業ディレクトリのパスは記録しない。診断envなしではsnapshotも取らない。[観測の追加試験](../../packages/runner/test/process-diagnostics.test.ts)で、自己変化する設定・副作用・取得時点と元の同期1回の呼出を確かめている。

起動前に中断された後続操作は `pre-spawn-interrupted`、実spawn1回で監視役の結果が欠けた操作は `missing-result` と分ける。ただしspawn観測の行自体が書けなかった場合は、実際に起動していても起動前と分類される可能性が残る。診断入力は1ファイル64KiB、最大128ファイル・合計512行までとし、上限到達と読めない行も集計する。公開schemaの検査上限はcalls・summaryのJSONが各1MiB、summary.mdが256KiB、heartbeat.jsonが2KiBで、rawの上限とは分けている。旧版1の単独sampleを版2での実行結果とは扱わない。

観測では、元の関数を同じ引数で一度だけ呼び、返値とthrowをそのまま返す。生の引数・環境値・出力・例外messageは記録しない。保存に失敗しても元の試験結果を変えないが、観測のI/Oとpreloadは実行時間や失敗頻度に影響しうる。単独実行の成功を、mainの並行実行での失敗の再現や修理完了とは扱わない。


CIの`diagnose-hook-budget`は、関連PRと手動起動で同じ1件を実行する。手動起動はworkflowをdefault branchへ取り込んだあとに使える。通常CIの試験範囲や期限は変えず、試験が失敗すればjobも失敗のままになる。

公開artifactには、専用export先の`calls.jsonl`・`summary.json`・`summary.md`・`heartbeat.json`だけを個別に指定し、7日間保存する。exportではcall IDを固定連番へ置き換え、許可したキー・列挙値・有限数・nullだけへ再投影してschemaを検査する。元のPID・生レポート・preload・一時ディレクトリ全体はアップロード対象に含めない。選択が1件でなければ集計を失敗にし、schema検査済みの診断がある場合だけartifactへ保存する。Step Summaryも検査済みの要約だけを使う。
