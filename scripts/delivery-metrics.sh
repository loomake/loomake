#!/usr/bin/env bash
# 配布ワークフロー改善ダッシュボードの指標を集める。PR の段階・所要時間・Codex の指摘数、Issue #121 の投稿量、worklog の量、CI の実行時間、時間切れの Issue、利用者の判断待ちの項目を CSV にする。
# 使い方: scripts/delivery-metrics.sh <出力ディレクトリ>   （gh と git と node と pnpm と python3 が要る。リポジトリ根で実行）
# gh は REST（gh api）だけを使う。Claude Code のクラウドのセッションでは GitHub の GraphQL が 403 になり、gh pr list・gh issue list が使えないため。
# node_modules がなければ pnpm install --frozen-lockfile を流すので、そのときはネットワークにつながっている必要がある。
# trace.md は origin/main から読む。ここでは origin/main を fetch するが、pending-approvals.mjs 自体は fetch しない。
# 出力は一時ディレクトリに書き、成功したら出力ディレクトリへ移す。判断待ちの段より前で gh に失敗したら、前のファイルをすべて残して非ゼロで終わる。
# 判断待ちの段だけが失敗したときは、ほかの CSV を移したうえで前の pending-approvals.csv を残し、非ゼロで終わる。
# PR の段階は scripts/ci-tier.mjs の classifyPath で決める（パスだけで判定し、spec.md の Requirement の変更は見ない）。
set -euo pipefail
OUT=${1:?出力ディレクトリ}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# PR の一覧には行数・ファイル・コメントが含まれないので、PR ごとに 3 つの API を呼ぶ（8 本並べて呼ぶ）
gh api "repos/loomake/loomake/pulls?state=all&per_page=100" --paginate --jq '.[]|select(.number>=100)|.number' > "$TMP/pr-numbers.txt"
python3 - "$TMP" <<'EOF'
import json,subprocess,sys
from concurrent.futures import ThreadPoolExecutor
S=sys.argv[1]; R="repos/loomake/loomake"
def api(path,jq):
    return subprocess.run(["gh","api",path,"--paginate","--jq",jq],check=True,capture_output=True,text=True).stdout.split("\n")
def fetch(n):
    pr=json.loads(api(f"{R}/pulls/{n}",'{number,title,createdAt:.created_at,mergedAt:.merged_at,state:(if .merged_at then "MERGED" elif .state=="closed" then "CLOSED" else "OPEN" end),additions,deletions,changedFiles:.changed_files}')[0])
    pr["codex_comments"]=sum(int(x) for x in api(f"{R}/issues/{n}/comments?per_page=100",'[.[]|select(.user.login|test("codex"))]|length') if x)
    pr["paths"]="|".join(x for x in api(f"{R}/pulls/{n}/files?per_page=100",'.[].filename') if x)
    return pr
nums=[int(x) for x in open(f"{S}/pr-numbers.txt").read().split()]
with ThreadPoolExecutor(8) as ex: prs=list(ex.map(fetch,nums))
with open(f"{S}/prs.jsonl","w") as f:
    for pr in prs: f.write(json.dumps(pr,ensure_ascii=False)+"\n")
EOF
# 段階は ci-tier.mjs と同じ関数で決める（規則を二重に持たない）
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
import { classifyPath } from "./scripts/ci-tier.mjs";
const rank = { L1: 1, L2: 2, L3: 3 };
const tiers = {};
for (const line of readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean)) {
  const pr = JSON.parse(line);
  const paths = pr.paths ? pr.paths.split("|") : [];
  tiers[pr.number] = paths.reduce((tier, path) => (rank[classifyPath(path)] > rank[tier] ? classifyPath(path) : tier), "L1");
}
writeFileSync(process.argv[2], JSON.stringify(tiers));
' "$TMP/prs.jsonl" "$TMP/tiers.json"
python3 - "$TMP" <<'EOF'
import json,datetime,csv,sys
S=sys.argv[1]; rows=[]
tiers=json.load(open(f"{S}/tiers.json"))
for l in open(f"{S}/prs.jsonl"):
    p=json.loads(l)
    c=datetime.datetime.fromisoformat(p["createdAt"].replace("Z","+00:00")); m=p["mergedAt"]
    hours=round((datetime.datetime.fromisoformat(m.replace("Z","+00:00"))-c).total_seconds()/3600,2) if m else ""
    rows.append(dict(number=p["number"],title=p["title"][:60],created=c.strftime("%Y-%m-%d"),state=p["state"],merged_hours=hours,
        lines=p["additions"]+p["deletions"],files=p["changedFiles"],tier=tiers[str(p["number"])],codex_comments=p["codex_comments"],phase="before" if p["number"]<187 else "after"))
rows.sort(key=lambda r:r["number"])
fields=["number","title","created","state","merged_hours","lines","files","tier","codex_comments","phase"]
w=csv.DictWriter(open(f"{S}/prs.csv","w",newline=""),fieldnames=fields); w.writeheader(); w.writerows(rows)
EOF
gh api "repos/loomake/loomake/issues/121/comments?per_page=100" --paginate --jq '.[]|"\(.created_at) \(.body|length)"' | python3 -c '
import sys,datetime,collections,csv
S=sys.argv[1]; d=collections.defaultdict(lambda:[0,0])
for l in sys.stdin:
    t,n=l.split(); dt=datetime.datetime.fromisoformat(t.replace("Z","+00:00"))+datetime.timedelta(hours=9)
    k=dt.strftime("%Y-%m-%d"); d[k][0]+=1; d[k][1]+=int(n)
w=csv.writer(open(f"{S}/issue121.csv","w")); w.writerow(["day","comments","chars"])
for k in sorted(d): w.writerow([k,*d[k]])' "$TMP"
git fetch -q origin main
git ls-tree -r -l origin/main -- docs/worklog | python3 -c '
import sys,csv,collections
S=sys.argv[1]; d=collections.defaultdict(int)
for l in sys.stdin:
    p=l.split(); d[p[4].split("/")[2][:10]]+=int(p[3])
w=csv.writer(open(f"{S}/worklog.csv","w")); w.writerow(["day","bytes"])
for k in sorted(d): w.writerow([k,d[k]])' "$TMP"
gh run list --workflow ci.yml --limit 1000 --json conclusion,createdAt,updatedAt --jq '.[]|[.createdAt,.updatedAt,.conclusion]|@tsv' | python3 -c '
import sys,datetime,collections,csv
S=sys.argv[1]; d=collections.defaultdict(lambda:{"runs":0,"failed":0,"minutes":0.0})
for l in sys.stdin:
    c,u,conc=l.rstrip("\n").split("\t")
    cd=datetime.datetime.fromisoformat(c.replace("Z","+00:00")); ud=datetime.datetime.fromisoformat(u.replace("Z","+00:00"))
    k=(cd+datetime.timedelta(hours=9)).strftime("%Y-%m-%d")
    d[k]["runs"]+=1; d[k]["failed"]+= conc=="failure"; d[k]["minutes"]+=(ud-cd).total_seconds()/60
w=csv.writer(open(f"{S}/ci.csv","w")); w.writerow(["day","runs","failed","avg_minutes"])
for k in sorted(d): w.writerow([k,d[k]["runs"],d[k]["failed"],round(d[k]["minutes"]/d[k]["runs"],1)])' "$TMP"
# 時間切れ・タイムアウトの Issue（題名で検索した 2 つの和集合）
# gh issue list --search と同じく、Issue だけを検索 API で探す（PR は除く）
for word in 時間切れ タイムアウト; do
  gh api -X GET search/issues -f q="repo:loomake/loomake is:issue in:title $word" -f per_page=100 --paginate --jq '.items[]|{number,title,state:(.state|ascii_upcase),createdAt:.created_at,closedAt:.closed_at}'
done | python3 -c '
import sys,json,csv
S=sys.argv[1]; seen={}
for l in sys.stdin:
    if l.strip(): i=json.loads(l); seen[i["number"]]=i
w=csv.writer(open(f"{S}/flaky.csv","w")); w.writerow(["number","title","state","created","closed"])
for n in sorted(seen): i=seen[n]; w.writerow([n,i["title"],i["state"],i["createdAt"][:10],(i.get("closedAt") or "")[:10]])' "$TMP"
mkdir -p "$OUT"
mv -f "$TMP"/prs.jsonl "$TMP"/prs.csv "$TMP"/issue121.csv "$TMP"/worklog.csv "$TMP"/ci.csv "$TMP"/flaky.csv "$OUT"/
# 利用者の判断待ち（Issue #121 の呼びかけ・判断待ちの節に中身がある開いている PR・origin/main の trace.md の未回答のブロッキングな確認事項）。
# 判定は scripts/pending-approvals.mjs。trace.md の未回答は verify と同じ core・kit の関数で決めるので、先に 2 つを build する。
# この段は失敗してもほかの CSV を巻き込まない。失敗したら前の pending-approvals.csv を残し、標準エラーを pending-approvals.err に書いて、最後に非ゼロで終わる。
# if の条件の中では set -e が効かないので、各行を && でつなぐ
pending_approvals() {
  gh api "repos/loomake/loomake/issues/121/comments?per_page=100" --paginate --jq '.[]|{login: .user.login, body, created_at, html_url, via_app: (if .performed_via_github_app then (.performed_via_github_app.slug // "unknown") else null end)}' > "$TMP/issue121-comments.jsonl" &&
  gh api "repos/loomake/loomake/pulls?state=open&per_page=100" --paginate --jq '.[]|{number,title,url: .html_url,body: (.body // ""),createdAt: .created_at}' |
    python3 -c 'import sys,json; json.dump([json.loads(l) for l in sys.stdin if l.strip()], open(sys.argv[1], "w"), ensure_ascii=False)' "$TMP/open-prs.json" &&
  { [ -d node_modules ] || pnpm install --frozen-lockfile >&2; } &&
  pnpm -s --filter @loomake/core --filter @loomake/kit build >&2 &&
  node scripts/pending-approvals.mjs "$TMP/issue121-comments.jsonl" "$TMP/open-prs.json" "$TMP/pending-approvals.csv" origin/main
}
fail=0
if pending_approvals 2>"$OUT/pending-approvals.err"; then
  mv -f "$TMP/pending-approvals.csv" "$OUT"/
  rm -f "$OUT/pending-approvals.err"
else
  echo "警告: 利用者の判断待ちの一覧を作れませんでした。前の pending-approvals.csv を残します（原因は $OUT/pending-approvals.err）" >&2
  fail=1
fi
ls -la "$OUT"
exit "$fail"
