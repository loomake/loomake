# OpenSpec change の書式（Loomake 規約つき）

OpenSpec 標準の書式に、Loomake の追加ルール（★）を足したもの。

## ディレクトリ

```
openspec/changes/<change-id>/
├── proposal.md
├── design.md                 # 必要なときだけ
├── tasks.md
├── trace.md                  # ★ Loomake 追加
└── specs/
    └── <capability>/
        └── spec.md           # 差分仕様
```

## proposal.md

```markdown
# <change-id>

## Why
要件書の背景を 2〜3 文で。出典：要件定義書 v1.2 §1

## What Changes
- 何が増える / 変わる / 消えるか（箇条書き）

## Non-goals
- 範囲外とされたもの（REQ-003：SSO 連携）
- 後のフェーズで作るもの（REQ-004：CSV 出力。フェーズ：2）

## Impact
- 影響する capability：auth
- 影響するコード：server/api/auth/*
```

### 品質 YAML の提案

UQ/PQ の案を既存の読取処理で確かめる例。Loomake 自身の quality.yaml の PQ-900 に要件 REQ-313 を関連づけたもので、別案件の目標やモデルの選定には使わない。

```yaml
version: 2
model: iso-iec-25010-2011
product:
  PQ-900:
    characteristic: functional_suitability
    subcharacteristic: functional_correctness
    blocking: true
    applicability: applicable
    linked_requirements: [REQ-313]
    evidence:
      - source: ci.test_report
        metric: required_subjects_with_failed_tests
        target: "== 0"
        min_samples: 1
```

## specs/<capability>/spec.md（差分）

```markdown
## ADDED Requirements

### Requirement: パスワードログイン
システムは、登録済みのメールアドレスとパスワードの組で利用者を認証 SHALL する。

Source: REQ-001

#### Scenario: 正しい組み合わせでログインする
- **WHEN** 登録済みのメールアドレスと正しいパスワードを送信する
- **THEN** セッションが発行され、200 を返す

#### Scenario: パスワードが違う
- **WHEN** 登録済みのメールアドレスと誤ったパスワードを送信する
- **THEN** 401 を返し、どちらが誤っているかは明かさない

## MODIFIED Requirements

### Requirement: <既存の Requirement 名と完全一致させる>
（変更後の全文を書く。差分だけ書かない）

Source: REQ-010

#### Scenario: ...

## REMOVED Requirements

### Requirement: <既存の Requirement 名>
**Reason**: なぜ消すか
**Source**: REQ-011
```

ルール：

- 見出しのレベル（`##` / `###` / `####`）は OpenSpec の決まりなので変えない
- 規範文には `SHALL` または `MUST` を入れる
- ★ 各 Requirement に `Source: REQ-xxx` 行を入れる（verify が検査する）
- ★ Scenario の WHEN / THEN はそのままテストケースになる粒度で書く
- MODIFIED は既存 Requirement の **名前を一字一句同じに** し、本文は全文を書く

## tasks.md

```markdown
## 1. 実装
- [ ] 1.1 ログイン API を追加する（REQ-001）
- [ ] 1.2 失敗回数を記録する（REQ-002）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `npx loomake verify --change <change-id> --done --scope local` を通す <!-- loomake:gate=done -->

注：3.1 はローカルの完了。最終の合格には、CI で `npx loomake verify --change <change-id> --done --scope ci` が exit 0（判定 PASS・要判断なし）になることと、必須 CI の成功が別に要る。これはタスクにしない
```

★ ローカルの完了ゲートのタスク（`verify --done --scope local` を通すタスク）の行末には `<!-- loomake:gate=done -->` を付ける。`loomake run` はこの印のあるタスクをエンジンに渡さず、ローカルの完了ゲートに合格したときに完了にする。末尾の注記はチェックボックスにしない。

★ 手動で `verify --done` を実行するときは、実装・テストのタスクを終え、実行前に 3.1 を `- [x]` にする。未チェックのままだと、完了ゲートのタスク自身が未完了として不合格になる。合格しなければ 3.1 を `- [ ]` に戻し、修正後に再実行する。`loomake run` に任せる場合は、run がこのチェックを扱う。

★ タスクの末尾に関係する REQ ID を書いておくと、runner（`loomake run`）がタスクとテストを結び付けやすくなる。
