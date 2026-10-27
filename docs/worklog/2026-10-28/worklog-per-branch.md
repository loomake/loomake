# 2026-10-28 の作業記録（worklog-per-branch）

## 作業記録をブランチごとのファイルに分ける（07:50）

- やったこと：change なし（AGENTS.md の運用の決まりの変更）。作業記録は複数のセッションが同じ日付のファイルに追記するため、競合とマージコミットが多い（直近 1 週間の Merge コミットは 78 件で、「作業記録の節を両方残す」という解消が多い）。また、作業記録だけの PR（#35・#9 など）でも 8 分以上の CI が走る。利用者の承認（2026-10-28 朝、「おすすめで進めて」）を受けて、origin/main（fe94cf4）からブランチ worklog-per-branch を作り、AGENTS.md 6 章の作業記録の決まりを書き換えた。作業記録はブランチごとのファイル `docs/worklog/<日本時間の日付>/<ブランチ名>.md` に書き（ブランチ名の `/` は `-` にする）、その作業の PR に含める。作業記録だけの PR は作らず、マージ後に足す記録は次の作業の PR に含める。2026-10-27 までの日付ごとのファイルは移さずに残した。この記録が、新しい形の最初のファイルである。
- docs/worklog を前提にしているものの調査：`tests/doc-links.test.ts` は docs/worklog/ をリンクの検査から外しており、サブディレクトリが増えても影響しない（docs/ の直下の .md だけを readdirSync で読む）。AGENTS.md の文言を検査しているテストはない。`tests/kit-assets.test.ts` が検査するのは init が配るテンプレート `packages/kit/templates/AGENTS.md` だけである。scripts/ と ci.yml に docs/worklog を前提にしたものはない。`scripts/ci-gate.mjs` の文書の判定（`.md` で終わるか、docs/・openspec/・.changeset/ の下か）では、docs/worklog/<日付>/ の下の .md も文書として扱う。PR #31 の `scripts/ci-docs-only.mjs`（origin/shorten-ci-wall-clock）の `isDocumentPath` も、docs/ の下の .md を深さを問わず文書として扱うので、新しい形のファイルだけの変更も品質コマンドを飛ばす対象になる。README.md の `docs/worklog/` へのリンクと docs/release.md の記述は、ディレクトリを指すだけなので変えていない。
- テンプレートの扱い：`packages/kit/templates/AGENTS.md` の 6 章にも同じ日付ごとのファイルの決まりがあるが、init が配る製品の振る舞いなので変えていない。利用者のリポジトリでも同じ問題が起きうるので、変えるなら change を作って扱う。
- verify の結果：change がないので verify は実行していない。PR の gate は、変えたファイルが文書だけなので品質コマンドだけを実行する（PR #35 と同じ扱い）。配布するパッケージを変えないので changeset は足していない（PR #35 も changeset なしで通っている）。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（73 ファイル、1029 件）は通った。
- 残っている確認事項・仮定：テンプレートの AGENTS.md を同じ決まりに変えるかどうか（change が要る）。作業中のほかの PR は、日付ごとのファイルに追記しているものがあるので、マージの前に新しい形に移すかどうかは各担当が決める。
- 次にやること：PR を作り、CI の結果を確かめる。
