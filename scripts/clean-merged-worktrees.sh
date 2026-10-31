#!/usr/bin/env bash
# マージ済みで clean な worktree を消す（rebuild-plan 2.6「マージされた PR の worktree は当日中に消す」）。
# 対象は git に登録された .codex/worktrees/* と .claude/worktrees/*。登録のないディレクトリは「未登録」と表示して触らない。
# 消すのは、ブランチを head にした PR が GitHub で merged になっているものだけ（gh pr list で確かめる。squash マージでも分かる）。
# 各 worktree の .loomake/ は、消す前に .loomake/archive/worktree-loomake-<日付>/<name>.tgz へ退避する。ブランチは消さない。
#
#   scripts/clean-merged-worktrees.sh [--dry-run] [--keep <name>]...
#
# 残すもの：detached HEAD、dirty なもの、.loomake/・node_modules/・dist/・coverage/ 以外の無視ファイルがあるもの、
# HEAD が origin/main と同じもの、マージ済み PR のないブランチ、いま自分がいる worktree、--keep で指定したもの。
# gh が使えなければ（未導入・未認証・API の失敗）何も消さず、判定だけを表示して終了コード 1 で終わる。
# 最後に git worktree prune と df -h / を表示する。
set -euo pipefail

dry_run=false
keep=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run=true ;;
    --keep)
      [ $# -ge 2 ] || { echo "--keep には名前が要ります" >&2; exit 2; }
      keep+=("$2"); shift ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "知らない引数です：$1" >&2; exit 2 ;;
  esac
  shift
done

# worktree の中から実行しても、主の作業ツリー（.git を持つ側）を根にする。パスは実体（pwd -P）でそろえる
self=$(cd "$(git rev-parse --show-toplevel)" && pwd -P)
root=$(cd "$(git rev-parse --git-common-dir)/.." && pwd -P)
cd "$root"
git fetch -q origin main
main=$(git rev-parse origin/main)
archive="$root/.loomake/archive/worktree-loomake-$(TZ=Asia/Tokyo date +%F)"

# gh でマージ済み PR を調べられるか。調べられなければ何も消さない
gh_ok=true
if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then gh_ok=false; fi

is_kept() {
  local n=$1 k
  for k in "${keep[@]+"${keep[@]}"}"; do [ "$k" = "$n" ] && return 0; done
  return 1
}

# 登録された worktree のパスを列挙する（実体のパスでそろえる）
registered=()
while IFS= read -r line; do
  case "$line" in
    "worktree "*) registered+=("$(cd "${line#worktree }" 2>/dev/null && pwd -P || echo "${line#worktree }")") ;;
  esac
done < <(git worktree list --porcelain)

is_registered() {
  local d=$1 r
  for r in "${registered[@]+"${registered[@]}"}"; do [ "$r" = "$d" ] && return 0; done
  return 1
}

# 無視ファイルのうち、.loomake/・node_modules/・dist/・coverage/ の下にないもの
stray_ignored() {
  git -C "$1" status --porcelain --ignored 2>/dev/null | sed -n 's/^!! //p' | grep -Ev '^(\.loomake/|(.*/)?(node_modules|dist|coverage)/)' || true
}

# マージ済み PR の番号。なければ空
merged_pr() {
  gh pr list --head "$1" --state merged --json number --jq '.[0].number // empty' 2>/dev/null
}

decide() {
  # 出力：keep <理由> か remove <理由>
  local d=$1 n head branch pr
  n=$(basename "$d")
  if is_kept "$n"; then echo "keep --keep の指定"; return; fi
  if [ "$d" = "$self" ]; then echo "keep いまいる worktree"; return; fi
  if ! branch=$(git -C "$d" symbolic-ref --short -q HEAD); then echo "keep detached"; return; fi
  if [ -n "$(git -C "$d" status --porcelain 2>/dev/null)" ]; then echo "keep dirty"; return; fi
  if [ -n "$(stray_ignored "$d")" ]; then echo "keep 無視ファイルあり：$(stray_ignored "$d" | head -3 | paste -sd '、' -)"; return; fi
  head=$(git -C "$d" rev-parse HEAD)
  if [ "$head" = "$main" ]; then echo "keep HEAD が origin/main と同じ"; return; fi
  if ! $gh_ok; then echo "keep gh を使えないので判定できない（ブランチ $branch）"; return; fi
  if ! pr=$(merged_pr "$branch"); then echo "keep gh pr list に失敗（ブランチ $branch）"; return; fi
  if [ -z "$pr" ]; then echo "keep PR なし（ブランチ $branch はマージ済み PR の head ではない）"; return; fi
  echo "remove PR #$pr merged（ブランチ $branch）"
}

removed=0
for base in .codex/worktrees .claude/worktrees; do
  [ -d "$base" ] || continue
  for d in "$base"/*/; do
    d=${d%/}
    [ -d "$d" ] || continue
    abs=$(cd "$d" && pwd -P)
    n=$(basename "$d")
    if ! is_registered "$abs"; then echo "未登録: $d（触りません）"; continue; fi
    verdict=$(decide "$abs")
    case "$verdict" in
      remove*)
        if $dry_run; then echo "消す予定: $d（${verdict#remove }）"; continue; fi
        if [ -d "$abs/.loomake" ]; then
          mkdir -p "$archive"
          tar -czf "$archive/$n.tgz" -C "$abs" .loomake
          echo "退避: $d/.loomake → ${archive#"$root"/}/$n.tgz"
        fi
        git worktree remove --force "$abs"
        echo "消した: $d（${verdict#remove }）"
        removed=$((removed + 1)) ;;
      keep*) echo "残す: $d（${verdict#keep }）" ;;
    esac
  done
done

if $dry_run; then echo "（--dry-run。何も消していません）"; else git worktree prune; echo "消した worktree：$removed 件"; fi
df -h / | tail -1
if ! $gh_ok; then echo "gh を使えないので、マージ済みかを判定できませんでした。何も消していません" >&2; exit 1; fi
