#!/usr/bin/env bash
# 配布ワークフロー改善ダッシュボードの指標を集める。PR の段階・所要時間・Codex の指摘数、Issue #121 の投稿量、worklog の量、CI の実行時間を CSV にする。
# ダッシュボード用の指標を集めて CSV にする（prs / worklog / issue121 / ci）。
# 使い方: bash collect.sh <出力ディレクトリ>   （gh と git と python3 が要る。リポジトリ根で実行）
set -euo pipefail
OUT=${1:?出力ディレクトリ}; mkdir -p "$OUT"
gh pr list --state all --limit 200 --json number,title,createdAt,mergedAt,state,additions,deletions,changedFiles,files,comments --jq '
  .[] | select(.number>=100) | {number,title,createdAt,mergedAt,state,additions,deletions,changedFiles,
   codex_comments: ([.comments[]|select(.author.login|test("codex"))]|length), paths: ([.files[].path]|join("|"))}' > "$OUT/prs.jsonl"
python3 - "$OUT" <<'EOF'
import json,re,datetime,csv,sys
S=sys.argv[1]; rows=[]
def tier(ps):
    t="L1"
    for x in ps:
        if re.match(r"packages/[^/]+/src/",x) or re.search(r"openspec/(specs|changes/[^/]+/specs)/.*spec\.md$",x): return "L3"
        if re.match(r"(tests?|\.github|scripts|\.agents/skills|packages/[^/]+/templates)/",x) or (x.startswith("packages/") and not x.endswith(".md")): t="L2"
    return t
for l in open(f"{S}/prs.jsonl"):
    p=json.loads(l); paths=p["paths"].split("|") if p["paths"] else []
    c=datetime.datetime.fromisoformat(p["createdAt"].replace("Z","+00:00")); m=p["mergedAt"]
    hours=round((datetime.datetime.fromisoformat(m.replace("Z","+00:00"))-c).total_seconds()/3600,2) if m else ""
    rows.append(dict(number=p["number"],title=p["title"][:60],created=c.strftime("%Y-%m-%d"),state=p["state"],merged_hours=hours,
        lines=p["additions"]+p["deletions"],files=p["changedFiles"],tier=tier(paths),codex_comments=p["codex_comments"],phase="before" if p["number"]<187 else "after"))
rows.sort(key=lambda r:r["number"])
w=csv.DictWriter(open(f"{S}/prs.csv","w",newline=""),fieldnames=rows[0].keys()); w.writeheader(); w.writerows(rows)
EOF
gh api "repos/loomake/loomake/issues/121/comments?per_page=100" --paginate --jq '.[]|"\(.created_at) \(.body|length)"' | python3 -c '
import sys,datetime,collections,csv
S=sys.argv[1]; d=collections.defaultdict(lambda:[0,0])
for l in sys.stdin:
    t,n=l.split(); dt=datetime.datetime.fromisoformat(t.replace("Z","+00:00"))+datetime.timedelta(hours=9)
    k=dt.strftime("%Y-%m-%d"); d[k][0]+=1; d[k][1]+=int(n)
w=csv.writer(open(f"{S}/issue121.csv","w")); w.writerow(["day","comments","chars"])
for k in sorted(d): w.writerow([k,*d[k]])' "$OUT"
git fetch -q origin main
git ls-tree -r -l origin/main -- docs/worklog | python3 -c '
import sys,csv,collections
S=sys.argv[1]; d=collections.defaultdict(int)
for l in sys.stdin:
    p=l.split(); d[p[4].split("/")[2][:10]]+=int(p[3])
w=csv.writer(open(f"{S}/worklog.csv","w")); w.writerow(["day","bytes"])
for k in sorted(d): w.writerow([k,d[k]])' "$OUT"
gh run list --workflow ci.yml --limit 1000 --json conclusion,createdAt,updatedAt --jq '.[]|[.createdAt,.updatedAt,.conclusion]|@tsv' | python3 -c '
import sys,datetime,collections,csv
S=sys.argv[1]; d=collections.defaultdict(lambda:{"runs":0,"failed":0,"minutes":0.0})
for l in sys.stdin:
    c,u,conc=l.rstrip("\n").split("\t")
    cd=datetime.datetime.fromisoformat(c.replace("Z","+00:00")); ud=datetime.datetime.fromisoformat(u.replace("Z","+00:00"))
    k=(cd+datetime.timedelta(hours=9)).strftime("%Y-%m-%d")
    d[k]["runs"]+=1; d[k]["failed"]+= conc=="failure"; d[k]["minutes"]+=(ud-cd).total_seconds()/60
w=csv.writer(open(f"{S}/ci.csv","w")); w.writerow(["day","runs","failed","avg_minutes"])
for k in sorted(d): w.writerow([k,d[k]["runs"],d[k]["failed"],round(d[k]["minutes"]/d[k]["runs"],1)])' "$OUT"
ls -la "$OUT"
{ echo 'number,title,state,created,closed'; for q in "時間切れ in:title" "タイムアウト in:title"; do gh issue list --state all --limit 100 --search "$q" --json number,title,state,createdAt,closedAt --jq '.[]|[.number,.title,.state,.createdAt[0:10],(.closedAt//"")[0:10]]|@csv'; done | sort -u; } > "$OUT/flaky.csv"
