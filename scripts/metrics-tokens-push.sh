#!/usr/bin/env bash
# トークン使用量の CSV を作り直し、データ専用ブランチ metrics-data の tokens.csv と違うときだけ、そのブランチに直接 push する。
# main には入れず、PR も作らない（データを更新するたびに PR と段階の判定が要らないようにするため）。
# 使い方: scripts/metrics-tokens-push.sh [--dry-run] [--no-generate <path>]   （git と python3 が要る。リポジトリの中で実行）
#   --dry-run             CSV の生成と比較だけを行い、差分の有無と予定のコミットを表示して止まる。コミットも push もしない
#   --no-generate <path>  scripts/metrics-tokens.py を動かさず、指定した CSV を使う
# CSV は一時ファイルに作るので、作業ツリーには何も書かない。
# コミットは git の下位コマンド（hash-object・mktree・commit-tree）で作るので、worktree もブランチも手元に作らない。
# origin に metrics-data が無ければ、親の無いコミット（orphan）として作る。後始末は trap で一時ディレクトリを消す。
set -euo pipefail

DATA_BRANCH=metrics-data
DATA_FILE=tokens.csv
DRY=0
SRC=
usage() { echo "使い方: scripts/metrics-tokens-push.sh [--dry-run] [--no-generate <path>]" >&2; exit 2; }
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --no-generate) [ $# -ge 2 ] || usage; SRC=$2; shift ;;
    *) usage ;;
  esac
  shift
done

ROOT=$(git rev-parse --show-toplevel)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

if [ -z "$SRC" ]; then
  SRC="$TMP/$DATA_FILE"
  python3 -I "$ROOT/scripts/metrics-tokens.py" --out "$SRC"
elif [ ! -f "$SRC" ]; then
  echo "$SRC がありません" >&2
  exit 1
fi

REF="refs/remotes/origin/$DATA_BRANCH"
if git ls-remote --exit-code --heads origin "$DATA_BRANCH" >/dev/null 2>&1; then
  git fetch --quiet origin "+refs/heads/$DATA_BRANCH:$REF"
  PARENT=$(git rev-parse "$REF")
else
  PARENT=
fi

if [ -n "$PARENT" ] && git cat-file -e "$PARENT:$DATA_FILE" 2>/dev/null \
  && git show "$PARENT:$DATA_FILE" | cmp -s - "$SRC"; then
  echo "$DATA_BRANCH の $DATA_FILE と同じです。push しません"
  exit 0
fi

DAY=$(TZ=Asia/Tokyo date +%F)
MSG="data(metrics): $DATA_FILE を $DAY 時点に更新

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

if [ "$DRY" -eq 1 ]; then
  if [ -n "$PARENT" ]; then
    echo "[dry-run] $DATA_BRANCH（${PARENT:0:12}）の $DATA_FILE と違います"
  else
    echo "[dry-run] origin に $DATA_BRANCH がありません。親の無いコミットとして作ります"
  fi
  echo "[dry-run] コミット: $DATA_FILE（$(wc -l < "$SRC" | tr -d ' ') 行）だけを差し替え、origin の $DATA_BRANCH に push"
  echo "[dry-run] コミットメッセージ:"
  echo "$MSG"
  echo "[dry-run] ここで止めます。コミットも push もしていません"
  exit 0
fi

# 既存のツリーから tokens.csv だけを差し替える（ほかのファイルがあれば残す）
BLOB=$(git hash-object -w -- "$SRC")
{
  if [ -n "$PARENT" ]; then
    git ls-tree "$PARENT" | awk -F'\t' -v f="$DATA_FILE" '$2 != f'
  fi
  printf '100644 blob %s\t%s\n' "$BLOB" "$DATA_FILE"
} > "$TMP/tree.txt"
TREE=$(git mktree < "$TMP/tree.txt")
if [ -n "$PARENT" ]; then
  COMMIT=$(git commit-tree "$TREE" -p "$PARENT" -m "$MSG")
else
  COMMIT=$(git commit-tree "$TREE" -m "$MSG")
fi
# 親を指定した fast-forward の push なので、途中でほかの更新が入っていれば拒否される。そのときは再実行する
git push --quiet origin "$COMMIT:refs/heads/$DATA_BRANCH"
echo "origin の $DATA_BRANCH に push しました（${COMMIT:0:12}）"
