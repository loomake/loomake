# WBS の GitHub Issues 移行仕様

版：v0.8（2026-10-28。移行を実行し、Projects と Issue fields を手作業に回した経緯と、本文の末尾の署名の扱いを書いた。v0.7 PR #10 のマージで完了条件がそろった W0-6・W0-7 を done にした。v0.6 PR #11 で足された W0-8 を件数と初期状態に加えた。v0.5 移行時の現状に書く残件を WBS v1.4 の契約に合わせることにした。v0.4 再実行で Issue の手修正を上書きしない規則を足し、W0-6 を partial に直した。v0.3 移行元を WBS v1.4 に変更し、Issue type「Stage」を作らないことにした。v0.2 初期状態の棚卸しの結果を反映。v0.1 初版）
対象：`loomake/loomake` の `docs/wbs/baseline-v1.4.md`（WBS v1.4。2026-10-28 に `docs/wbs.md` から移した固定版）
関連：`docs/wbs/baseline-v1.4.md`、`docs/wbs/initial-status.yaml`、`scripts/wbs-to-issues.py`、`docs/requirements-matrix.md`、`docs/requirements/loomake-v0.11.md`

この文書は WBS の作業項目を GitHub Issues に移す手順と、移行後の運用ルールを定める。段階計画と各作業の中身は変えない。

## 1. 方針

| 管理対象 | 正本 |
|---|---|
| 段階計画・出口・受入シナリオ | 要件定義 10 章 |
| WBS の初期計画 | `docs/wbs/baseline-v1.4.md`（PR で確定したあと固定） |
| 作業項目・依存関係・実行状態 | GitHub Issues |
| 変更の仕様 | OpenSpec change |
| 進捗の表示 | GitHub Projects |
| PR の検証結果 | CI と `loomake verify` |
| 納品単位の検収 | Loomake の検収記録 |

WBS ID（`W1-6` など）を安定識別子とし、Issue 番号は外部識別子として扱う。`requirements-matrix.md` は今後も WBS ID で参照し、Issue 番号は書き込まない。

## 2. 移行対象の内訳

v1.3.1 を機械的に読み取った結果は次のとおり。v1.4 で作業項目が増減したら、移行前に数え直す。

| 段階 | 作業項目 | 出口 |
|---|---|---|
| W0 準備 | 8 | なし（段階 1 の前半） |
| W1 段階 1 | 14 | A03 A04 A15 A16 A17 A20 A22 |
| W2 段階 2 | 5 | A08 A12 A13 A21 |
| W3 段階 3 | 8 | A01 A02 A05 A06 A07 |
| W4 段階 4 | 3 | A09 A14 |
| W5 段階 5 | 7 | A10 A18 A19 A23 |
| W6 配布 | 9 | W6-3 の導入検証 |
| 合計 | 54 | |

依存は範囲表記（`W1-7〜W1-11` など）を展開すると 85 本になる。段階をまたぐ依存が 23 本あり、循環はない。W6-6〜W6-9（d50586e）と W0-8（dc58ff3）は、v1.3.1 の調査のあとに main で追加された。ID で書かれていない依存は W6-4 の「各段階の出口」の 1 件だけである。

W7（初回完成後）は作業項目の表を持たず、採用前の候補の一覧なので移行しない。採用した時点で `W7-<連番>` を振って起票する。

## 3. 分解ルール

### 3.1 階層

| 階層 | GitHub での表現 | Issue type | WBS ID の例 |
|---|---|---|---|
| 段階 | 親 Issue | 付けない（Feature でもよい） | `W1` |
| 作業項目 | 段階の sub-issue | Task | `W1-6` |
| 作業の部分範囲 | 作業項目の sub-issue | Task | `W1-6.1` |

- 段階には Milestone を使わない。親 Issue にすると、出口の受入シナリオを本文に持たせられ、Hierarchy View で配下と一緒に見られる。
- 3 階層目は移行時には作らない。WBS 5 章の「完了範囲」のように、1 つの作業を複数の change で分けて完了させるときだけ作る（3.3）。
- 3 階層目の ID は `W<段階>-<連番>.<枝番>` とする。ハイフンでつなぐと、将来 WBS 本体に 3 階層目ができたときに区別できなくなるため。

### 3.2 段階 Issue の閉じ方

段階 Issue は「配下の sub-issue がすべて閉じた」ではなく「出口の受入シナリオと、その時点の必須回帰確認が通った」で閉じる（WBS 4 章の冒頭）。W1-14 のように段階の後続でも出口に含まれない作業があるためである。段階 Issue の本文に出口のチェックリストを置き、全項目が確認できたら `completed` で閉じる。

### 3.3 change と作業項目の対応

WBS の作業項目と OpenSpec change は多対多になる。WBS 5 章の C-001 は W1-1・W1-2・W1-4・W1-5 の一部を完了範囲に持つ。

- PR の単位は change とする。
- change が作業項目の一部だけを完了させる場合は、その範囲を 3 階層目の sub-issue として切り、PR はその sub-issue を `Closes` で閉じる。親の作業項目は `Refs` で参照するだけにする。
- 作業項目は、配下がすべて閉じ、かつ本文の完了条件を人が確認したときに閉じる。
- どの change が関わったかは Issue field の `Change` に記録する（4.2）。change を別の Issue として起票しない。

C-001〜C-003 を 3 階層目に切ると、次の 10 件になる。W1-5 と W1-7 は、3 つの change が終わっても残りの範囲があるため開いたままになる。

| 親 | 枝番 | 範囲 | change |
|---|---|---|---|
| W1-1 | W1-1.1 | quality.yaml と verify JSON のスキーマ | C-001 |
| W1-1 | W1-1.2 | spec・tasks・trace.md のスキーマ | C-002 |
| W1-2 | W1-2.1 | aborted と終了コード 0〜3 の契約テスト | C-001 |
| W1-2 | W1-2.2 | partial と禁止フィールドのテスト | C-003 |
| W1-4 | W1-4.1 | 条件の判定と集約 | C-001 |
| W1-4 | W1-4.2 | 版の確認と自動実行条件 | C-002 |
| W1-4 | W1-4.3 | 証跡の適格性と実施確認 | C-003 |
| W1-5 | W1-5.1 | `--done --json` の骨組み | C-001 |
| W1-5 | W1-5.2 | `--spec-only` | C-002 |
| W1-7 | W1-7.1 | change の生成とブロッキング確認事項 | C-002 |
| W1-3、W1-6 | なし | C-003 で全体を完了するため切らない | C-003 |

### 3.4 ID で書かれていない依存

W6-4（文書とサイト）は段階の出口ごとに繰り返す作業なので、依存関係を張らない。各段階の出口が近づいた時点で `W6-4.<段階番号>` の sub-issue を切り、その段階 Issue に blocked-by を張る。

## 4. Issue の形式

### 4.1 本文

移行スクリプトで作る Issue も、テンプレート（`.github/ISSUE_TEMPLATE/task.yml`）から人が作る Issue も、同じ見出し構成にする。Issue forms は `### <ラベル>` の見出しで本文を組み立てるため、スクリプトもこれに合わせると、Runner が 1 つの読み取り処理で扱える。

```markdown
### WBS ID
W1-6

### 作業
kit：外部コマンドの共通 spawn 関数と証跡の収集。…

### 成果物
収集モジュール、マスキング処理

### 完了条件
ツール固有の変更が呼び出し処理と変換処理に閉じ、秘密値がログ・証跡・レポートに残らないテストが通る

### 参照
- NFR-09
- 要件定義 7.9

### 備考
証跡を初めて保存する W1-10 の依存先

### 移行時の現状
- 関連する実装: packages/kit/src/runtime/process.ts（外部コマンドの共通関数）、packages/runner/src/mask.ts（runner だけのマスキング）
- 完了条件に足りないもの: 各ツールの出力を読む収集モジュール、kit・trace の証跡へのマスキング

<!-- loomake-wbs: source=docs/wbs/baseline-v1.4.md@<commit> generated=<sha256> -->
```

- 依存は本文に書かない。正本は GitHub の dependencies（blocked-by）とする。
- 「参照」には要件 ID（FR・NFR・A・O）と章番号を 1 行に 1 つずつ書く。要件定義やアーキテクチャを改訂したとき、影響する Issue をこの欄で検索する（WBS 冒頭の見直し手順を Issues 側に引き継ぐ）。
- 「移行時の現状」は、`initial-status.yaml` の判定が partial の Issue にだけ付ける。移行時点の記録なので、作業が進んでも書き換えない。
- 末尾の HTML コメントは、移行元と、スクリプトが生成した本文の SHA-256 を示す。移行後に人が本文を直してもよい。直した本文は再実行で上書きしない（6.2）。

### 4.2 Issue fields

| フィールド | 型 | 値 | 公開範囲 | 書く主体 |
|---|---|---|---|---|
| WBS ID | Text | `W1-6`、`W1-6.1` | Public | 移行・起票時 |
| Stage | Single select | W0〜W7 | Public | 移行・起票時（WBS ID から導出） |
| Change | Text | `C-001` または OpenSpec の change 名 | Public | 着手時 |
| Priority | Single select（既定） | Urgent / High / Medium / Low | Public | 人 |
| Effort | Single select（既定） | High / Medium / Low | Public | 人（W1-9 の実績が出てから） |

- 既定の Start date・Target date は削除せずに残し、期日が決まった作業だけに使う。
- 組織あたり 25 個の上限に対し、既定 4 個と追加 3 個で 7 個になる。
- 公開リポジトリなので、外部の人も計画を追えるよう Public にする。

### 4.3 タイトル

`[W1-6] 外部コマンドの共通 spawn 関数と証跡の収集` の形にする。タイトル先頭の ID と WBS ID フィールドが一致しない Issue は、整合チェック（7 章）で検出する。

### 4.4 ラベル

移行・起票した Issue に `wbs` ラベルを付ける。移行スクリプトと整合チェックはこのラベルで検索範囲を絞ってから WBS ID で照合する。分類（Bug・Feature・Task）はラベルではなく Issue type で表す。

## 5. Projects の設定

### 5.1 Status

| 値 | 意味 |
|---|---|
| Backlog | 未着手。依存が未完了のものもここに置く |
| Ready | 着手条件（5.2）を満たし、人が着手を許可した |
| In Progress | 作業中（人または Runner） |
| In Review | PR がレビュー待ち |
| Blocked | 依存以外の理由で止まっている（人の判断待ち、`decision.required` など） |
| Done | 完了 |

- 依存が未完了のことは dependencies で分かるので、Blocked には入れない。Blocked は外部要因に限る。
- Projects の組み込みワークフロー（Issue を閉じると Done）は有効にしてよい。ただし `not_planned` で閉じた場合も Done になるため、Runner と整合チェックは Status ではなく `stateReason` を見る。

### 5.2 着手条件（Ready の判定）

Runner が作業を取るのは、次のすべてを満たすときに限る。

1. Status が Ready
2. blocked-by の Issue がすべて閉じていて、`stateReason` が `COMPLETED`（`NOT_PLANNED`・`DUPLICATE` は完了とみなさない）
3. 対応する OpenSpec change が `verify --spec-only` を通り、必要な確認・承認が有効期限内（FR-20）
4. 同じ Issue を実行中の Runner がない

条件 4 は当面、GitHub Actions の `concurrency`（グループ名に Issue 番号を入れる）で守る。同じグループで保留できるジョブは 1 件だけで、後から来た保留ジョブが前の保留ジョブを置き換える。このため Runner は起動直後に 1〜3 を再確認し、満たさなければ何もせずに終了する。Mac mini など Actions 以外からも起動するようになったら、共有の永続ストアにリース方式の排他（原子的な取得、期限切れ、所有者の確認）を追加する。

### 5.3 ビュー

| ビュー | レイアウト | 設定 |
|---|---|---|
| WBS | Table | Show hierarchy をオン。列は WBS ID・Stage・Status・Priority・Change |
| Execution | Board | Status で列分け。Stage が現在の段階の Task だけを表示 |
| Roadmap | Roadmap | 段階 Issue だけを表示。日付は決まったものだけ入れる |

ビューの作成と設定は `gh project` でできないため、初回は手作業で行う。

## 6. 移行の手順

### 6.1 前提作業

1. 初期状態の棚卸し：各作業項目の完了条件と既存の実装・仕様・change を突き合わせ、`docs/wbs/initial-status.yaml` に判定と根拠を書く。判定は done・partial・none の 3 つで、done は Done（`completed` で閉じる）、partial と none は Backlog で移す。partial を In Progress にしないのは、In Progress を「いま誰かが作業中」の意味に保つためである。partial の Issue には本文の「移行時の現状」に、関連する実装と足りないものを書く。足りないもの（`missing`）は、WBS v1.4 で採用した契約に照らして書く。調査時点の食い違いの所見（`wbs_mismatch`）は記録として残すが、Issue 本文には転記しない。2026-10-27 時点の調査案では done 6 件、partial 25 件、none 23 件だった。
2. WBS 本文の不一致の修正：W0-2 と W0-3 は npm workspaces・node:test・Biome を前提に書かれているが、リポジトリは pnpm・Vitest・ESLint を使っている。移行前に WBS 側を実態に合わせるか、構成を変える作業として残すかを決める。
3. 組織の設定：Issue fields に WBS ID・Stage・Change を追加する。

### 6.2 実行

移行スクリプトは次の 4 段で動き、どこで止まっても最初から再実行できる。

| 段 | 内容 | 既存のものがあるとき |
|---|---|---|
| 0. 読み取り | 固定したコミットの `docs/wbs.md` と `initial-status.yaml` を読み、移行計画（作成・更新・関連付け・変更なし）を出力する。`--dry-run` ではここで止まる | なし |
| 1. 作成 | 段階 Issue → 作業項目 Issue の順に作る | `wbs` ラベルと WBS ID で 1 件見つかれば、生成したときのままのタイトル・本文だけを更新する（下の規則）。WBS ID と Stage は空のときだけ書き、値が違えば報告する。2 件以上見つかれば中断する |
| 2. 関連付け | sub-issue と blocked-by を張る | 張られていない関係だけを追加する。入力にない既存の関係は削除せず、報告だけする |
| 3. Projects | Issue を Project に追加し、初期 Status を入れる | Status は新規追加したときだけ書く。移行後に人や Runner が変えた値を上書きしない |

段 1 で既存の Issue を更新するのは、前回スクリプトが生成した内容から人が変えていないときに限る。本文は、末尾の HTML コメントにある `generated` の SHA-256 と、現在の本文（HTML コメントを除く）の SHA-256 が一致するときだけ書き換える。タイトルも、前回生成したタイトルと一致するときだけ書き換える。一致しなければ書き換えず、競合として報告する。途中で止まったあとの再実行でも同じ規則で動くので、手で直した完了条件や作業範囲が古い内容に戻ることはない。

作成（段 1）と関連付け（段 2）を分けるのは、親や依存先がまだない状態で失敗したときに、途中から再開できるようにするためである。

### 6.3 移行後

1. `docs/wbs.md` を `docs/wbs/baseline-v1.4.md` に移し、冒頭の「正本」の記載を「移行時点の固定版。作業項目の正本は GitHub Issues」に書き換える。
2. 同じファイルの末尾に、WBS ID と Issue 番号の対応表を移行スクリプトの出力から追記する。以後は更新しない。
3. `requirements-matrix.md` の「関連」にある `docs/wbs.md` の参照先を更新する。
4. 最初の 2〜3 件は Runner を使わずに手で回し、着手条件と本文の形式に問題がないかを確認する。

## 7. 整合チェック

GitHub Actions の定期ジョブで次を確認し、違反があれば Issue にコメントするか、1 件の報告 Issue にまとめる。

| 検出すること | 例 |
|---|---|
| タイトルの ID と WBS ID フィールドの不一致 | タイトルが `[W1-6]` でフィールドが `W1-7` |
| 同じ WBS ID の Issue が 2 件以上ある | 手で起票した Issue と重複 |
| Status が Ready なのに blocked-by に未完了の Issue がある | 依存先が `NOT_PLANNED` で閉じられた |
| Stage と WBS ID の段階番号の不一致 | WBS ID が `W2-3` で Stage が W1 |
| 閉じた作業項目の配下に開いた sub-issue がある | 部分範囲を残したまま親を閉じた |

## 8. 計画を変えるとき

- 段階の中身や出口を変えるときは、従来どおり要件定義を先に直す。
- 要件定義やアーキテクチャを改訂したら、改訂した章や要件 ID を Issue 本文の「参照」で検索し、該当する Issue の作業・完了条件・依存を見直す。
- 作業項目を追加するときは、その段階の最大の連番に 1 を足した WBS ID を振る。欠番は再利用しない。
- 作業項目をやめるときは `not_planned` で閉じる。WBS ID は欠番として残す。

## 9. 確認事項

| No. | 内容 | 推奨 |
|---|---|---|
| 1 | 移行後の `docs/wbs.md` の扱い（v1.4 を PR で確定してから固定することにした。以後、要件定義・アーキテクチャの変更は PR、作業項目の変更は Issue で行う）。v1.0〜v1.3.1 は PR のレビューを通して改訂されてきた。固定版にすると、作業定義の変更はレビューを経ずに Issue 上で行われることになる | 合意どおり固定版にする。作業定義を大きく変えるときは、要件定義の PR で議論してから Issue に反映する |
| 2 | 初期状態の調査案（`initial-status.yaml`）の確認 | done の 6 件（W0-2・W0-4・W0-6・W0-7・W0-8・W6-6）と、確度の低い W1-12・W6-7 を人が確かめる。W6-7 は別リポジトリ（loomake/site）の状態による。W0-1 は要件対応表に「割り当てを確定して W0-1 を閉じる」が残っているため、W0-6 は PR #10 で ADR と O15 の解決がそろったため done にした |
| 3 | WBS・要件定義・アーキテクチャが前提とする形と、実装の食い違い。道具の名前（pnpm・Vitest・ESLint）だけでなく、設計にも及ぶ。core は Zod を使わず依存ゼロ、設定は quality.yaml ではなく loomake.config.json、verify JSON は 7.3 の契約ではなく旧形式、判定の純関数は kit ではなく core にある | 移行の前に、どちらに合わせるかを要件定義・アーキテクチャの段階で決める。決めずに移すと、partial の 25 件の完了条件が「作り直し」なのか「文書の修正」なのか読めない |
| 4 | Issue type「Stage」を作るか | 作らないことにした（2026-10-26）。段階は親 Issue で表し、出口で閉じる |

## 10. 移行の実施記録

2026-10-28 に、コミット 0521b58 の WBS v1.4（54 件）と初期状態（done 6、partial 25、none 23）から、`scripts/wbs-to-issues.py --apply` で移した。

- 作った Issue は 61 件（段階の親 7 件、作業項目 54 件）。sub-issue は 54 本、blocked-by は 85 本。done の 6 件は根拠をコメントして `completed` で閉じた。WBS ID と Issue 番号の対応は `docs/wbs/baseline-v1.4.md` の 9 章にある
- 同じ入力で再実行し、作成・更新・関連付けがどれも 0 件になることを確かめた
- 移行を実行したセッションは Organization の API に触れられなかったため、Projects の作成と Issue fields（WBS ID・Stage・Change・Priority・Effort）の設定は行っていない。WBS ID はタイトルの先頭と本文の「WBS ID」の見出しにあり、移行スクリプトと整合チェックはこれで照合する。Projects と Issue fields は、Organization の管理者が手作業で設定する（5 章の設定）
- GitHub に書き込んだ本文の末尾には、ツールが署名（`Generated by …`）を足すことがある。移行スクリプトは、末尾の HTML コメントの印より後ろを比べない
- 3 階層目（`W1-4.1` など）は、C-001〜C-003 の change に着手するときに切る（3.3）
