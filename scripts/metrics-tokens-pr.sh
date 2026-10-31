#!/usr/bin/env bash
# トークン使用量の CSV（docs/metrics/tokens.csv）を作り直し、origin/main と違うときだけ L1 の PR を出す。
# 使い方: scripts/metrics-tokens-pr.sh [--dry-run] [--no-generate]   （git と gh と python3 が要る。リポジトリ根で実行）
#   --dry-run      差分とブランチを確かめ、作るコミットと PR の中身を表示して止まる。ブランチ・コミット・push・PR は作らない
#   --no-generate  scripts/metrics-tokens.py を動かさず、いまの docs/metrics/tokens.csv をそのまま使う
# 差分が無ければ何もせず exit 0。ブランチ metrics/tokens-<日本時間の日付> が手元か origin に既にあれば、メッセージを出して exit 0。
# コミットと push は一時的な git worktree で行うので、いまのブランチと作業ツリーの他のファイルには触らない。
set -euo pipefail

CSV=docs/metrics/tokens.csv
DRY=0
GEN=1
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --no-generate) GEN=0 ;;
    *) echo "使い方: scripts/metrics-tokens-pr.sh [--dry-run] [--no-generate]" >&2; exit 2 ;;
  esac
done

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

if [ "$GEN" -eq 1 ]; then
  python3 -I scripts/metrics-tokens.py --out "$CSV"
fi
if [ ! -f "$CSV" ]; then
  echo "$CSV がありません" >&2
  exit 1
fi

git fetch --quiet origin main
# origin/main の CSV と比べる（まだ origin/main に無いときは差分ありとみなす）
if git cat-file -e "origin/main:$CSV" 2>/dev/null && git show "origin/main:$CSV" | cmp -s - "$CSV"; then
  echo "$CSV は origin/main と同じです。PR は出しません"
  exit 0
fi

DAY=$(TZ=Asia/Tokyo date +%F)
BR="metrics/tokens-$DAY"
if git rev-parse --verify --quiet "refs/heads/$BR" >/dev/null \
  || git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
  echo "ブランチ $BR は既にあります。今日の分は出してあるので何もしません"
  exit 0
fi

TITLE="chore(metrics): トークン使用量の CSV を更新する（$DAY）"
MSG="$TITLE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

body() {
  local head=$1
  cat <<EOF
loomake-change: none
loomake-tier: L1

## 変える問題と結果

\`scripts/metrics-tokens.py\` で開発機のログから集計し直した \`$CSV\` を入れる。$DAY 時点の値。

## 公開契約と移行

- 変更理由・影響する公開契約と利用側：計測用の CSV だけで、公開契約には影響しない
- パッケージと形式のバージョン・changeset：対象外
- 利用側の移行方法・旧形式を読む範囲と再利用する範囲：対象外
- 維持する旧fixture・追加する新fixture・対応を外す場合の根拠：対象外
- 契約テスト・配布物の検証結果と未確認の範囲：対象外

## 実行したゲートとテスト

- [ ] \`pnpm -s verify --change <change-id> --done\` が exit 0（change がないので対象外）
- [ ] \`pnpm lint\`・\`pnpm typecheck\`・\`pnpm test\`（CSV だけの変更なので CI に任せる）

## 確認事項・仮定と決定の記録

なし

## 人の判断が必要な項目

なし

## 未確認の環境と検証の制約

開発機のログだけが出典で、他の端末の分は含まない。

## 証跡

\`\`\`text
head: $head
tier: loomake-tier: L1（scripts/ci-gate.mjs）
ci: 未実施
codex-review: 未実施
reviewed-head: 対象外（L1）
opus-review: 対象外（L1）
opus-model: 対象外（L1）
process: 自動更新（scripts/metrics-tokens-pr.sh）
\`\`\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
}

if [ "$DRY" -eq 1 ]; then
  echo "[dry-run] ブランチ: $BR（origin/main から）"
  echo "[dry-run] コミット: $CSV だけ"
  echo "[dry-run] コミットメッセージ:"
  echo "$MSG"
  echo "[dry-run] PR のタイトル: $TITLE"
  echo "[dry-run] PR の本文:"
  body "<push 後のコミットの SHA>"
  echo "[dry-run] ここで止めます。ブランチ・コミット・push・PR は作っていません"
  exit 0
fi

WT=$(mktemp -d)
cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1 || true; rm -rf "$WT"; }
trap cleanup EXIT
git worktree add --quiet -b "$BR" "$WT" origin/main
mkdir -p "$WT/$(dirname "$CSV")"
cp "$CSV" "$WT/$CSV"
git -C "$WT" add -- "$CSV"
git -C "$WT" commit --quiet -m "$MSG" -- "$CSV"
HEAD_SHA=$(git -C "$WT" rev-parse HEAD)
git -C "$WT" push --quiet -u origin "$BR"
gh pr create --base main --head "$BR" --title "$TITLE" --body "$(body "$HEAD_SHA")"
