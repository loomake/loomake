# Proposal: run-other-os-after-merge

## Why

PR の CI は、1 回が中央値で約 10 分かかる。Ubuntu の quality ジョブは 3〜4 分で終わるが、Windows は 7〜10 分かかり、これが全体の待ち時間を決めている。直近 20 回のうち 8 回が失敗し、その多くは Windows と macOS の時間切れだった。ブランチ保護は設定しておらず、どのジョブを必須とするかは運用上の約束にすぎない。

利用者は 2026-10-28 に、開発速度のボトルネック対策 A として、PR では Ubuntu だけで品質を確かめ、macOS と Windows はマージのあとで確かめる方針を承認した。

## What Changes

- quality ジョブの OS のマトリクスを、式で切り替える。PR に `ci:all-os` ラベルがなければ ubuntu-latest だけ、それ以外（main への push、定期実行、ラベルのある PR）では 3 つの OS にする（REQ-049 を MODIFIED、REQ-273）
- ワークフローの起動に、毎日 1 回の定期実行（schedule）と、PR にラベルを付けたとき（labeled）を足す
- node20・node22・gate のジョブは変えない
- 既存のテスト（`tests/monorepo.test.ts` の `[REQ-049]`・`[REQ-214]`・`[REQ-270]`、`tests/package-workflows.test.ts` の `[REQ-144]`）のうち、マトリクスの OS の行と `on:` の行を読む部分を、新しい ci.yml に合わせる。3 つの条件（ラベルのない PR、main への push と定期実行、ラベルのある PR）で、どの OS の quality ジョブができるかをそれぞれ確かめる。シャード・カバレッジ・文書だけの PR の検査は弱めない

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: 「3 つの OS での CI」（REQ-049）を、PR では ubuntu だけ、main への push・定期実行・`ci:all-os` ラベルのある PR では 3 つの OS で実行する形に直す

## Non-goals

- Windows で失敗しているテストを直すこと（Issue #5）
- macOS と Windows のシャードの数を変えること、gate でテストを二重に実行しないようにすること
- ブランチ保護を設定すること

## Impact

- 影響するファイル：`.github/workflows/ci.yml`、`tests/monorepo.test.ts`、`tests/package-workflows.test.ts`、`README.md`（CI の説明）
- 配布するパッケージは変えないので、changeset は空にする
- macOS と Windows だけで起きる失敗は、PR では見つからず、main に入ってから見つかる。見つけたら、別の PR で直す。macOS か Windows に関わる変更をする PR では、`ci:all-os` ラベルを付ける
- change shorten-ci-wall-clock は main に入っているが、まだ archive していない。その差分仕様も REQ-049 を MODIFIED にしているので、この change を先に archive すると、あとで shorten-ci-wall-clock を archive したときに REQ-049 が古い文に戻る。そこで、この PR では shorten-ci-wall-clock を先に archive し、そのあとでこの change を archive する。この change の REQ-049 の文には、shorten-ci-wall-clock が足した「文書だけの PR」の例外を含める
