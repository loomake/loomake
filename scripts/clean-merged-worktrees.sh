#!/usr/bin/env bash
# マージ済みで clean な worktree を消す（rebuild-plan 2.6「マージされた PR の worktree は当日中に消す」）。
# 対象は git に登録された .codex/worktrees/* と .claude/worktrees/*。登録のないディレクトリは「未登録」と表示して触らない。
# 各 worktree の .loomake/ は、消す前に .loomake/archive/worktree-loomake-<日付>/<name>.tgz へ退避する。ブランチは消さない。
#
#   scripts/clean-merged-worktrees.sh [--dry-run] [--keep <name>]...
#
# 残すもの：dirty なもの、origin/main に含まれないもの、HEAD が origin/main と同じもの（管理役の main 用）、いま自分がいる worktree、--keep で指定したもの。
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
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "知らない引数です：$1" >&2; exit 2 ;;
  esac
  shift
done

# worktree の中から実行しても、主の作業ツリー（.git を持つ側）を根にする
self=$(git rev-parse --show-toplevel)
root=$(cd "$(git rev-parse --git-common-dir)/.." && pwd -P)
cd "$root"
git fetch -q origin main
main=$(git rev-parse origin/main)
archive="$root/.loomake/archive/worktree-loomake-$(TZ=Asia/Tokyo date +%F)"

is_kept() {
  local n=$1 k
  for k in "${keep[@]+"${keep[@]}"}"; do [ "$k" = "$n" ] && return 0; done
  return 1
}

# 登録された worktree のパスを列挙する
registered=()
while IFS= read -r line; do
  case "$line" in
    "worktree "*) registered+=("${line#worktree }") ;;
  esac
done < <(git worktree list --porcelain)

is_registered() {
  local d=$1 r
  for r in "${registered[@]+"${registered[@]}"}"; do [ "$r" = "$d" ] && return 0; done
  return 1
}

decide() {
  # 出力：keep <理由> か remove
  local d=$1 n head
  n=$(basename "$d")
  if is_kept "$n"; then echo "keep --keep の指定"; return; fi
  if [ "$d" = "$self" ]; then echo "keep いまいる worktree"; return; fi
  if [ -n "$(git -C "$d" status --porcelain 2>/dev/null)" ]; then echo "keep dirty"; return; fi
  head=$(git -C "$d" rev-parse HEAD)
  if [ "$head" = "$main" ]; then echo "keep HEAD が origin/main と同じ"; return; fi
  if ! git merge-base --is-ancestor "$head" "$main"; then echo "keep origin/main に含まれない"; return; fi
  echo remove
}

removed=0
for base in .codex/worktrees .claude/worktrees; do
  [ -d "$base" ] || continue
  for d in "$base"/*/; do
    d=${d%/}
    [ -d "$d" ] || continue
    abs="$root/$d"
    n=$(basename "$d")
    if ! is_registered "$abs"; then echo "未登録: $d（触りません）"; continue; fi
    verdict=$(decide "$abs")
    case "$verdict" in
      remove)
        if $dry_run; then echo "消す予定: $d"; continue; fi
        if [ -d "$abs/.loomake" ]; then
          mkdir -p "$archive"
          tar -czf "$archive/$n.tgz" -C "$abs" .loomake
          echo "退避: $d/.loomake → ${archive#"$root"/}/$n.tgz"
        fi
        git worktree remove --force "$abs"
        echo "消した: $d"
        removed=$((removed + 1)) ;;
      keep*) echo "残す: $d（${verdict#keep }）" ;;
    esac
  done
done

if $dry_run; then echo "（--dry-run。何も消していません）"; else git worktree prune; echo "消した worktree：$removed 件"; fi
df -h / | tail -1
