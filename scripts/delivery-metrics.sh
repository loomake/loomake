#!/usr/bin/env bash
# 配布ワークフロー改善ダッシュボードの指標を集める。PR の段階・所要時間・Codex の指摘数、Issue #121 の投稿量、worklog の量、CI の実行時間を CSV にする。
# 使い方: scripts/delivery-metrics.sh <出力ディレクトリ>   （gh と git と node と python3 が要る。リポジトリ根で実行）
# 出力は一時ディレクトリに書き、すべて成功したら出力ディレクトリへ移す。gh に失敗したら前のファイルを残して非ゼロで終わる。
# PR の段階は scripts/ci-tier.mjs の classifyPath で決める（パスだけで判定し、spec.md の Requirement の変更は見ない）。
set -euo pipefail
OUT=${1:?出力ディレクトリ}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

gh pr list --state all --limit 200 --json number,title,createdAt,mergedAt,state,additions,deletions,changedFiles,files,comments --jq '
  .[] | select(.number>=100) | {number,title,createdAt,mergedAt,state,additions,deletions,changedFiles,
   codex_comments: ([.comments[]|select(.author.login|test("codex"))]|length), paths: ([.files[].path]|join("|"))}' > "$TMP/prs.jsonl"
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
mkdir -p "$OUT"
mv -f "$TMP"/prs.jsonl "$TMP"/prs.csv "$TMP"/issue121.csv "$TMP"/worklog.csv "$TMP"/ci.csv "$OUT"/
ls -la "$OUT"
