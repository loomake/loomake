# Loomake kit（最小セット）

要件書・仕様書から AI 駆動で開発するためのスターターキット。OpenSpec の上に「要件書からの入口」と「守らせる仕組み」を足す。

将来はモノレポ `loomake/loomake` の `packages/kit`（npm: `@loomake/kit`）になる。全体の構成と方針は [docs/architecture.md](docs/architecture.md) を参照。

```
AGENTS.md                         共通ルールの正本（Claude Code / Codex 共通）
CLAUDE.md                         AGENTS.md を読み込むだけ
loomake.config.json               テストの場所・品質コマンド
scripts/verify.mjs                仕様ゲート / 完了ゲート（依存なし、Node 20.19+）
.devcontainer/devcontainer.json   開発コンテナ（Node 24・pnpm・OpenSpec・Claude Code・Codex）
.claude/skills/req-to-openspec/   要件書 → OpenSpec change
  ├── SKILL.md
  ├── templates/trace.md          要件台帳・確認事項・仮定
  └── references/
      ├── ambiguity-checklist.md  曖昧さの洗い出し観点
      └── openspec-format.md      OpenSpec 書式 + Loomake 追加ルール
docs/architecture.md              Loomake 全体の構成・役割分担・作る順番
```

## 導入

1. このフォルダの中身をプロジェクトのルートにコピー
2. devcontainer を使う場合は、VS Code / Cursor で「コンテナーで再度開く」。使わない場合は `pnpm add -g @fission-ai/openspec`
3. `openspec init`
4. `AGENTS.md` 末尾の「プロジェクト固有の情報」と `loomake.config.json` の commands を書き換える
5. Codex で使う場合は `.claude/skills/` を `.agents/skills/` にもコピー（または symlink）

## 流れ

```
要件書 ──req-to-openspec──▶ openspec/changes/<id>/ (+ trace.md)
                               │
          verify --spec-only ──┤ ブロッキング確認事項が残っていたら止まる
                               │
                 実装（tasks.md）│ テスト名に [REQ-xxx]
                               │
               verify --done ──┘ tasks 完了 / 確認待ちゼロ / 全要件にテスト / lint・型・テスト
```

```sh
node scripts/verify.mjs --change <id> --spec-only
node scripts/verify.mjs --change <id> --done
node scripts/verify.mjs --change <id> --done --json   # trace・runner から読む用
```

CLI ができたら `loomake verify --change <id> --done` に置き換わる予定。

## devcontainer について

- `~/.claude` と `~/.codex` を名前付きボリュームにしているので、コンテナを作り直しても再ログイン不要
- AI を権限確認なし（`--dangerously-skip-permissions` など）で動かすときは、許可ドメイン以外への通信を止めるファイアウォールを追加すること。Claude Code 公式リポジトリの devcontainer 例が参考になる。runner の段階では必須
- Mac では Docker Desktop より OrbStack のほうが軽い
