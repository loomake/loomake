# 0005 開発の仕組みを製品の仕様から外す

- 状態：採用
- 決めた日：2026-10-28
- 決めた人：利用者（「おすすめで進めて」の承認。分け方は作業の担当がおすすめで決めた）
- 出典：change `move-dev-mechanics-to-docs` の trace.md（振り分けの表と確認事項 Q-01〜Q-04）

## 決定

製品の仕様（`openspec/specs/`）には、利用者や配布物に影響する約束だけを残す。リポジトリの開発者だけに効く仕組み（devcontainer、CI のジョブの組み方、テストの書き方の前提など）は、仕様から外して [docs/dev/](../dev/README.md) に書く。docs/dev の仕組みは change を通さずに直せる。仕組みを守る試験は残し、名前に要件 ID を入れない。

## 検討した選択肢

- **A：開発の仕組みを docs/dev に移す**：利点は、CI やテストの書き方を少し直すときに、change・要件 ID・trace が要らなくなること。仕様を読む人が製品の約束だけを読めること。欠点は、docs/dev の仕組みが仕様ゲートと完了ゲートの外に出ること。試験は残るが、試験と説明がずれても verify では気づけない
- **B：すべて仕様に残す**：利点は、どの決まりも同じ手順（change と verify）で扱えること。欠点は、小さな CI の修正にも change が要り、trace.md が膨らむこと（change shorten-ci-wall-clock の trace.md は 14KB ある）
- **C：開発の仕組みを別の capability（たとえば `repository-development`）に分けて、仕様に残す**：利点は、製品の仕様と見分けやすくなること。欠点は、change が要る点が B と変わらないこと

## 理由

A を選ぶ。開発の仕組みは利用者に届かないので、change で合意を残す価値が小さい。一方で、変えるたびに change・要件 ID・テスト・trace をそろえる手間は大きい。B と C はこの手間を減らせない。A の欠点（説明と試験のずれ）は、仕組みを守る試験を残すことで小さくする。

分け方の基準は次のとおり。

- **仕様に残す**：配布物の中身・exports・メタデータ・README、Node.js の対応範囲の宣言、公開（release ワークフロー）の品質ゲート・認証・権限・action の固定、パッケージ間とパッケージの中の依存の向き、ライセンス、完了ゲートの振る舞い
- **docs/dev に移す**：devcontainer、CI のジョブの分け方・テストの分割・古い実行の取り消し、テストの書き方の前提（OS によらないテストの前提、偽の CLI など）
- 迷うものは仕様に残し、change の trace.md の確認事項に書く

## 適用範囲

`openspec/specs/` のすべての capability と、`docs/dev/` に及ぶ。最初に、monorepo の 4 個の Requirement（devcontainer、PR の古い CI 実行の取り消し、OS によらないテストの前提、外部操作の期限の試験の偽の CLI）を外した。

次のものには及ばない。

- 利用者に配るテンプレート（`packages/kit/templates/`）。devcontainer の雛形も含め、init の仕様で扱う
- 進行中の change が MODIFIED にしている Requirement（3 つの OS での CI、CI のテストの分割）。それぞれの change の archive のあとに、別の change で外す

## 見直す条件

- 完了ゲートの CI を、利用者に reusable workflow として配るようになり、docs/dev の仕組みが利用者に届くようになったとき
- docs/dev の説明と試験のずれが原因で、開発の仕組みが壊れたことが 2 回以上あったとき
