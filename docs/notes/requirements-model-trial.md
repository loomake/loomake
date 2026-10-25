# 要件モデルの試行（5 件）

最終更新：2026-10-25（v0.3：`blocks` を要件の正本から外し、kit の派生結果にした。`spec_refs` を任意項目として追加。v0.2：定義済みの条件を「参照が解決でき、対象・手順・判定基準がそろう」に改めた。5 章を検証設計の完了として「見込み」と「確認済み」を分けた。着手時に要求する項目を change の作業に必要な範囲に限った。8 章にレビュー記録の試行を追加。v0.1 初版）
対象：要件定義 v0.10.3（2026-10-25）とアーキテクチャ v2.1 の付録 A。本文を読み直して記述を移した。v0.10.3 と v2.1 はプロジェクト側で書いていた時点の版で、本文は保存していない。リポジトリの正本（`docs/requirements/loomake-v0.11.md` v0.11.1、`docs/architecture.md` v2.5.3）はそれ以降の改訂を含み、改訂の内容はそれぞれの版の記載にある。この試行は最新版で確かめ直していない
関連：`docs/notes/requirements-writing-guide.md`

要件定義の FR・NFR を機械可読の共通モデルに移せるかを、種類の散った 5 件で試す。目的は、必須にできる項目と任意にしかできない項目を実物で確かめ、それからスキーマを固めること。本書の YAML は試行用で、Loomake の契約ではない。

## 1. 前提

- 要件本文は自然言語のまま。機械可読にするのは周辺の構造と参照関係
- 仕様側は OpenSpec の specs と既存の契約（7.3、7.9）を参照し、仕様モデルを新設しない
- 検証対応表は要件モデルから生成する派生物。表の生成処理は判定を再実装せず、kit の関数の結果を並べるだけ
- 検査の層（何を調べたか）と 4 値（その結果）は別の軸。各層の検査が 7.3 の規則で結果を返す

### 1.1 保存できる条件と、着手・リリースできる条件

| 検査 | 担当 | 通る条件 |
|---|---|---|
| 構造 | core | ID、本文、状態、拘束力が形式どおり。これだけで保存できる |
| 参照整合性 | core が参照を解決し、kit が判定 | ID の重複と参照切れがない |
| 着手可否 | kit（verify --spec-only） | その change に含む要件に、実装を妨げる未決事項がない。受入基準と検証方法が定義されている |
| リリース可否 | kit（verify --done）とリリース記録 | 対象の検証が実行され、結果が条件を満たし、現在の対象に有効 |

FR-02 で質問する項目（目的、利用状況、受け入れ条件、計測方法、副特性）は、構造検査では任意にする。着手可否の検査で要求するのは、その change に含む要件のうち、要件の種類とその change の作業に必要な情報だけとする。解消済みの未決事項の ID は要らず、段階が change から一意に分かるなら要件側に重複して書かせない。

### 1.2 検証の状態は 4 つの軸で持つ

| 軸 | 値 | 決め方 |
|---|---|---|
| 定義状態 | 未定義／参照あり／定義済み | 参照先が解決でき、対象・手順・判定基準がそろっていれば「定義済み」。参照はあるが解決できないか、3 つのどれかが欠けていれば「参照あり」。未決事項 ID の有無では決めない |
| 実行状態 | 未実行／実行済み／実行不能 | 判定の要約の `run.status` と、対象の検証項目が要約の `checks` にあるか。要約があるだけでは決めない |
| 結果 | PASS／FAIL／INSUFFICIENT_EVIDENCE／NOT_APPLICABLE | 要約の `checks[].result` |
| 有効性 | 有効／再確認が必要／再確認不可 | 7.9 の再利用条件（対象コミット、仕様の版、quality.yaml の版、環境、検証方法）と、FR-38 の「現在の再確認可否」 |

「実行済み・FAIL・有効」のような組み合わせを表せる。

## 2. 試行用のモデル

要件 1 件を 1 つの YAML で表す。コメントの「保存」「着手」「リリース」は、どの検査で必須になるか。

```yaml
id: FR-08                      # 保存。重複不可
kind: functional               # 保存。functional / quality / constraint
statement: >-                  # 保存。本文は自然言語のまま
  証跡の適格性を確かめる。…
rationale: 2章「テスト未実施、古い結果、基準の緩和が完了報告に紛れ込む」   # 任意。要求元
status: agreed                 # 保存。draft / review / agreed / open / retired
binding: must                  # 保存。must / should / may
priority: must                 # 任意。段階とは別
stage: 1                       # 任意。10章の段階計画
acceptance:                    # 着手で必須（その change に含む要件のみ）
  - id: AC-08-1
    statement: 対象コミットと仕様の版が一致しない要約を、最新版の合格に使わない
    verification:              # 着手で必須
      - kind: scenario         # scenario / test / ci-check / review / observation
        ref: A03
open_items:                    # 任意。未決事項への参照。正本に持つのは参照だけ
  - ref: O02
depends_on: []                 # 任意。他の要件への参照
spec_refs: []                  # 任意。OpenSpec の Requirement など仕様への参照。検証方法ではない
```

未決事項が何を妨げるか（実装、マージ、リリース）は、対象作業と対象版に依存する kit の判定結果で、要件の正本には持たない。kit は未決事項の種類・解決状態・対象要件と、change の作業範囲から判断し、結果を判定の要約の `decision` に書く。

`acceptance[].verification[].ref` は、受入シナリオ（A）、テスト名、CI の検査名、レビュー記録、観察記録のいずれかを指す。参照先の種類ごとに解決方法が違うので、`kind` を必須にする。

## 3. 5 件の記述

### FR-08 証跡の適格性（機能要件）

```yaml
id: FR-08
kind: functional
statement: >-
  証跡の適格性を確かめる。対象コミットと仕様の版が一致し、必要な検証が実際に実行され、
  環境・実施日時・結果を確認できること。古いコミットの結果や対象不一致の結果を
  最新版の合格に流用しない。未評価・証跡不足はPASSにしない
rationale: 2章「テスト未実施、古い結果、基準の緩和が完了報告に紛れ込む」
status: agreed
binding: must
priority: must
stage: 1
acceptance:
  - id: AC-08-1
    statement: 古いコミットのテスト結果を受信しても、最新版の合格に流用されない
    verification: [{kind: scenario, ref: A03}]
  - id: AC-08-2
    statement: 必須の検証が未実行なら INSUFFICIENT_EVIDENCE になる
    verification: [{kind: scenario, ref: A04}]
  - id: AC-08-3
    statement: 判定関数は同じ入力で同じ結果を返す
    verification: [{kind: test, ref: 判定関数の固定fixtureテスト}]
open_items: []
```

### FR-16 外部イベントの重複防止（機能要件、未決に依存）

```yaml
id: FR-16
kind: functional
statement: >-
  外部イベント（Webhook）に一意のIDを付け、同じPRや公開を二重に作らない。
  PR作成直後に停止しても、再開時に外部状態を照合して既存PRを使う
rationale: 1.1「継続実行：再開の成功率、重複した副作用の件数」
status: agreed
binding: must
priority: must
stage: 3
acceptance:
  - id: AC-16-1
    statement: 同じWebhookを複数回受信しても、同じPRや公開が二重に作られない
    verification: [{kind: scenario, ref: A05}]
  - id: AC-16-2
    statement: PR作成直後に停止しても、再開時に既存PRを使う
    verification: [{kind: scenario, ref: A06}, {kind: test, ref: 障害注入}]
open_items:
  - ref: O02
```

### FR-49 人力工数の推定（機能要件、検証方法が未定義）

```yaml
id: FR-49
kind: functional
statement: >-
  changeを起こすとき、AIが人力で実装した場合の工数を幅（最小・最大・根拠）で推定し、
  changeの`estimate`に残す。推定は実装を始める前に固定し、実装後に書き換えない。
  推定の作業範囲は実績（FR-50）と同じ。比較方式を`estimate.baseline`に記録する
rationale: 1.1「開発効率」
status: agreed
binding: must
priority: should
stage: 1
acceptance:
  - id: AC-49-1
    statement: estimate が最小・最大・根拠・baseline を持ち、実装開始後に変更されない
    verification: []            # 未定義。対応する受入シナリオも未決事項もない
open_items: []
depends_on: [FR-50]
```

### NFR-04 一人で保守できる規模（品質要件）

```yaml
id: NFR-04
kind: quality
statement: >-
  一人で保守できる規模に保つ。自作はCLIとActionsの定義に限り、
  エージェント、レビュー、計測基盤は借りる。クラス階層、DIコンテナ、
  汎用プラグイン基盤は具体的な必要が出るまで入れない
rationale: 3章の前提「開発者は1人」
status: agreed
binding: must
priority: must
stage: null                     # 全段階に掛かる
acceptance:
  - id: AC-04-1
    statement: クラス階層、DIコンテナ、汎用プラグイン基盤が入っていない
    verification: [{kind: review, ref: アーキテクチャ付録A「クラス階層、DIコンテナ、汎用プラグイン基盤を入れない」}]
open_items: []
```

### NFR-01 実行時依存の制限（制約）

```yaml
id: NFR-01
kind: constraint
statement: >-
  実行時の依存は`@loomake/core`の`zod`と`@loomake/kit`の`yaml`に限る。
  増やすときは、標準機能で足りないこと、自作よりコードと保守が減ること、
  実行経路に必要なことを文書に書く
rationale: アーキテクチャ 0.1
status: agreed
binding: must
priority: must
stage: 1
acceptance:
  - id: AC-01-1
    statement: 各パッケージの dependencies が core は zod、kit は yaml のみ
    verification: [{kind: ci-check, ref: dependencies の予算照合}]
  - id: AC-01-2
    statement: 依存を足した PR に、採用理由の 3 点が文書に書かれている
    verification: [{kind: review, ref: PR レビュー}]
open_items: []
```

## 4. 生成される対応表

要件モデルから生成した形。実行状態は、まだ実装がないので全件「未実行」。結果と有効性は、要約がないので空。

| 要件ID | 受入基準 | 検証方法 | 定義状態 | 実行状態 | 結果 | 有効性 | 優先度 | 段階 | 未決（対象） |
|---|---|---|---|---|---|---|---|---|---|
| FR-08 | AC-08-1〜3 | A03、A04、固定fixtureテスト | 定義済み | 未実行 | | | must | 1 | |
| FR-16 | AC-16-1〜2 | A05、A06、障害注入 | 定義済み | 未実行 | | | must | 3 | O02（妨げる作業は kit が判定） |
| FR-49 | AC-49-1 | （なし） | 未定義 | 未実行 | | | should | 1 | |
| NFR-04 | AC-04-1 | 設計レビュー | 参照あり（8 章の定義で定義済みになる） | 未実行 | | | must | 全段階 | |
| NFR-01 | AC-01-1〜2 | CI の依存照合、PR レビュー | AC-01-1 は定義済み、AC-01-2 は参照あり | 未実行 | | | must | 1 | |

FR-49 は未決事項 ID を持たないのに定義状態が「未定義」になる。未決事項の有無で定義状態を決めてはいけない、という指摘がそのまま表に現れている。NFR-04 と NFR-01 の AC-01-2 は、付録 A や「PR レビュー」への参照はあるが、確認の手順と判定基準がその参照先にないので「参照あり」に留まる。参照があることと定義が十分なことは別で、ここも表に現れている。

## 5. 境界の確認（検証設計。実行はまだ）

この章は境界ケースの入力と期待結果を決めた段階で、検証設計の完了に当たる。実装を実行していないので、表の「期待する結果」は既存の判定で処理できる見込みであり、確認済みではない。実行したら、実行記録への参照をこの表に足して確認済みに変える。

最初の change を C-001「最小の quality.yaml を読み込み、限定した規則で検査し、定義済みの結果と終了コードを返す」とし、FR-08（AC-08-3 の範囲）、NFR-01、NFR-02 を含むとする。比較用に C-002「runner の Webhook 受信と再開」を置き、FR-16 を含むとする。

| 確認 | 入力 | 期待する結果 | 担当 |
|---|---|---|---|
| 未決でも保存できる | FR-49（検証方法なし）、FR-16（O02 未解決） | 構造検査を通り、保存される。対応表に「未定義」「O02」として出る | core |
| 依存する change だけ保留される | C-001 と C-002 に verify --spec-only | C-001 は FR-16 を含まないので通る。C-002 は FR-16 の O02 が未解決で、kit が C-002 の作業範囲への依存を判定して実装を妨げると判断するので止まる。FR-49 の未定義は、FR-49 を含む change だけを止める | kit |
| 参照切れを検出する | FR-08 の verification に `{kind: scenario, ref: A99}` を足す | 参照整合性検査が「A99 は存在しない」を返し、着手可否で止まる。構造検査は通る（保存はできる） | core が解決、kit が判定 |
| 古い結果を有効扱いしない | FR-08 の要約が対象コミット abc・仕様ハッシュ X を持ち、現在の仕様ハッシュが Y | 有効性が「再確認が必要」になり、リリース可否で結果を再利用しない（7.9 の再利用条件、A03） | kit |

4 つとも、既存の判定（verify --spec-only、7.9 の再利用条件）に要件モデルの参照を渡すだけで確かめられる見込みで、表の生成側に新しい判定は要らない。

## 6. 試行で分かったこと

必須にできた項目は、`id`、`kind`、`statement`、`status`、`binding` の 5 つ。これだけで構造検査が成立する。

任意にしかできない項目は次のとおり。

- `acceptance` と `verification`。FR-49 のように、要件は合意済みでも検証方法が決まっていない段階がある。着手可否の検査で、change に含む要件についてだけ必須にする
- `stage`。NFR-04 のように全段階に掛かる要件がある。`null` を許す
- `open_items`。正本に持つのは参照だけで、妨げる作業と解決状態は kit が対象作業・対象版に対して判定する派生結果。正本の固定属性にしない
- `rationale`。2 章の課題に ID がないので、今は見出しの引用になる。課題に ID を振れば参照に変えられる

`verification.kind` に `review` と `ci-check` を入れたことで、NFR-04 と NFR-01 のように受入シナリオを持たない要件も「定義済み」にできた。受入シナリオだけを検証方法にすると、品質要件と制約は全件「未定義」になる。

次に全件へ広げるときは、`kind: review` の参照先をどう記録として残すかを先に決める。8 章でその試行を 1 件行った。

## 7. 未決

| 項目 | 次の確認方法 |
|---|---|
| 2 章の課題に ID を振るか | 要件定義の次の改訂で決める |
| 要件モデルを core の内部スキーマに留めるか、公開契約（0.4）にするか | 段階 1 で自分の FR・NFR を全件通してから決める |
| 未コミットの変更を対象にしたレビュー記録の識別方法（8.2） | 段階 1 の最初の change で、ローカルの verify と同じ識別（`scope: local`）を使えるか試す |
| レビュー定義の版を、ハッシュと Git の版のどちらで参照するか（8.2） | 定義を 1 度改訂してみて、要約との照合がしやすい方を選ぶ |

## 8. レビュー記録の試行（NFR-04）

レビューを検証方法にする要件の実行状態を「実行済み」にできるように、レビュー定義とレビュー実行記録を分けて 1 件通す。対象は付録 A の「クラス階層、DI コンテナ、汎用プラグイン基盤を入れない」（原則 0.2、方針）。確認対象と合否基準を具体化しやすいので選んだ。

### 8.1 レビュー定義

置き場は `docs/verification/reviews/<定義ID>.md`。正本は Git で版管理する。

```yaml
id: REV-001
version: 1
requirements: [NFR-04]
acceptance: [AC-04-1]
source: アーキテクチャ付録 A「クラス階層、DI コンテナ、汎用プラグイン基盤を入れない」
target: packages/*/src/ の TypeScript ソース。tests/ と配布テンプレートは対象外
items:
  - id: REV-001-1
    check: 継承で 3 段以上の階層を作っているクラスがない
    criteria: 該当クラスが 0 件なら PASS。1 件以上なら FAIL
    evidence: 該当クラスの一覧（ファイルと行）
  - id: REV-001-2
    check: DI コンテナ（依存を名前で登録し解決する仕組み）を自作または導入していない
    criteria: 該当する実装と依存が 0 件なら PASS
    evidence: 検索した語（container、inject、provide、resolve）と結果
  - id: REV-001-3
    check: プラグインの登録と動的読み込みの汎用基盤を持っていない。外部ツールの呼び出しは spawn の共通関数に閉じている
    criteria: 動的読み込みの共通基盤が 0 件なら PASS。spawn の共通関数は該当しない
    evidence: 動的 import と registry 相当の箇所の一覧
reconsider: 同じ境界に複数の実装が並び、追加のたびに既存を広く触るようになったとき（付録 A）
```

対象・手順（items の check）・判定基準（criteria）・必要な証跡（evidence）がそろうので、NFR-04 の AC-04-1 は「定義済み」になる。

### 8.2 レビュー実行記録

置き場は `.loomake/evidence/<対象識別子>/reviews/<実行ID>.json`。結果の値は 7.3 の 4 値と `run.status` をそのまま使い、レビュー専用の判定体系を増やさない。

```json
{
  "version": 1,
  "kind": "review",
  "review_id": "REV-001",
  "review_version": 1,
  "review_hash": "sha256:…",
  "target": { "commit": "abc1234", "uncommitted": false },
  "reviewer": "r",
  "reviewed_at": "2026-11-02T10:00:00+09:00",
  "run": { "status": "completed", "errors": [] },
  "checks": [
    { "id": "REV-001-1", "result": "PASS", "reason": "該当クラス 0 件", "evidence": ["reviews/REV-001-run-0001/classes.txt"] },
    { "id": "REV-001-2", "result": "PASS", "reason": "該当なし", "evidence": ["reviews/REV-001-run-0001/grep.txt"] },
    { "id": "REV-001-3", "result": "FAIL", "reason": "packages/kit/src/plugins.ts に registry 相当の実装", "evidence": ["reviews/REV-001-run-0001/dynamic-import.txt"] }
  ],
  "findings": [
    { "check": "REV-001-3", "message": "plugins.ts を削除するか、必要の根拠を ADR に書く", "ref": "PR #12" }
  ]
}
```

この例は、記録の形を示すための架空の値で、実際のレビュー結果ではない。`target.uncommitted` が true の場合の識別方法は未決（7 章）。指摘を修正したら対象のコミットが変わるので、この記録は残し、新しい実行 ID で再レビューを記録する。

### 8.3 読み取りから表示までの流れ

| 段 | 担当 | すること |
|---|---|---|
| 定義の読み取り | core | REV-001 を読み、要件 NFR-04 と受入基準 AC-04-1 への参照を解決する |
| 記録の読み取り | core | 実行記録を読み、`review_hash` と定義の現在のハッシュ、`target.commit` を共通形式に変換する。合否は決めない |
| 判定 | kit | 定義の版が一致するか（7.3 の順序 1）、対象コミットが現在の対象に対して 7.9 の再利用条件を満たすか（順序 2）、全 items に結果があるか（順序 3）を確認し、checks を集約する（FAIL が 1 件あるので NFR-04 は FAIL） |
| 表示 | レポート | NFR-04 の行に、定義状態「定義済み」、実行状態「実行済み」、結果「FAIL」、有効性「有効」（対象コミットが現在のコミットと一致する場合）を入れる |

この流れは 5 章と同じく検証設計で、実行していない。実行するときは、8.2 の JSON を固定 fixture にして、kit の判定関数に渡すテストから始める。

### 8.4 試行で分かったこと

- レビューを「定義」と「実行記録」に分けると、定義状態と実行状態が別の記録から決まり、1.2 の 4 軸と一致する
- 実行記録の `checks` と `run` を 7.3 と同じ形にしたので、kit の集約規則をそのまま使える。レビュー専用の判定は増えなかった
- 付録 A の表現「入れない」は、そのままでは判定基準にならない。REV-001 のように「3 段以上の継承」「名前で登録し解決する仕組み」まで具体化して初めて定義済みになる。付録 A の他の「レビュー」項目も、全件に広げるときに同じ具体化が要る
- 定義の版の参照（`review_version` と `review_hash` の両方を持たせた）は、どちらかに絞る判断が残る（7 章）
