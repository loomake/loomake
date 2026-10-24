# 貢献のしかた

Loomake は Loomake 自身の決まりで開発している。AI のエンジンと人が守る決まりは [AGENTS.md](AGENTS.md)、change の進め方は [docs/flow.md](docs/flow.md) にある。

## 開発の環境

- Node.js 24（配布物が動く下限は package.json の `engines`）と、pnpm（版は package.json の `packageManager`）を使う。[.devcontainer/](.devcontainer/) の devcontainer でも開ける
- 次のコマンドで、ビルドと品質の検査をする

```sh
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## 振る舞いを変えるとき

- いまの仕様は `openspec/specs/` にある。仕様にない振る舞いは実装しない。振る舞いを変えるときは、`openspec/changes/<change-id>/` に change（proposal・差分仕様・tasks・trace）を作る。`openspec/specs/` は直接書き換えない
- 実装の前に仕様ゲートを、終えたら完了ゲートを通す

```sh
pnpm -s verify --change <change-id> --spec-only
pnpm -s verify --change <change-id> --done
```

- テストの名前には確かめる要件の ID を入れる（例：`it('[REQ-012] 未ログインのとき 401 を返す', ...)`）
- テストを弱める、skip する、期待値を実装に合わせて書き換える、lint・型・テストの設定を緩める、といった変更はしない。必要なら PR で理由を書いて相談してほしい

## PR を出すとき

- PR 本文に、対象の change を `loomake-change: <change-id>` の行で書く。change のない PR なら `loomake-change: none` と書く。CI の gate ジョブは、この行で完了ゲートの対象を決める
- パッケージ（`packages/` の下）を変えたら、`pnpm changeset` で changeset を足す。配布物が変わらない変更（テストだけなど）では `pnpm changeset add --empty` を使う
- CI は Ubuntu・macOS・Windows で品質の検査を実行する

## コードの書き方

- 関数は named export にする
- 利用者に見せるメッセージは日本語で書く
- パッケージの依存の向きを守る。`@loomake/core` は実行時依存なし、`@loomake/kit` は core だけ、`@loomake/trace` は core と kit だけ、`@loomake/runner` は core・kit・trace だけ、`loomake` は core・kit・trace・runner だけに依存する

## 脆弱性

脆弱性は Issue に書かず、[SECURITY.md](SECURITY.md) の手順で報告してほしい。
