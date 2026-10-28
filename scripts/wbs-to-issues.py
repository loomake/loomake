#!/usr/bin/env python3
"""WBS（docs/wbs/baseline-v1.4.md）を GitHub Issues に移す（docs/wbs/migration.md の 6.2）。

  python3 scripts/wbs-to-issues.py --repo loomake/loomake --dry-run
  python3 scripts/wbs-to-issues.py --repo loomake/loomake --apply --out mapping.json

移行元は docs/wbs/baseline-v1.4.md（固定版）。--dry-run も GitHub の今の状態を読み、--apply で
実際に作る・足す・閉じる分だけを数える。

段 0 読み取り → 段 1 作成 → 段 2 関連付け（sub-issue と blocked-by）の順に動く。
どこで止まっても最初から再実行でき、WBS ID で既存の Issue を探して重複を作らない。
既存の Issue の本文は、前回生成したときのまま（本文末尾の generated= と一致）で、タイトルが
生成するタイトルと同じときだけ書き換え、人が直した Issue は競合として報告する。
初期状態が done の作業項目は根拠をコメントして閉じる。途中で止まっても続きから閉じるが、
人が開き直した Issue は閉じない。
Projects と Issue fields は Organization の設定が要るため、このスクリプトは扱わない。
gh（GitHub CLI）の REST API だけを使う。
"""
import argparse, hashlib, json, re, subprocess, sys

LABEL = 'wbs'
MARK = re.compile(r'<!-- loomake-wbs: source=(\S+) generated=([0-9a-f]{64}) -->')


def gh(args, data=None, ok404=False):
    cmd = ['gh', 'api'] + args
    if data is not None:
        cmd += ['--input', '-']
    r = subprocess.run(cmd, input=json.dumps(data) if data is not None else None,
                       capture_output=True, text=True)
    if r.returncode != 0:
        if ok404 and 'Not Found' in r.stderr:
            return None
        raise RuntimeError(f"gh api {' '.join(args)} failed: {r.stderr.strip()}")
    return json.loads(r.stdout) if r.stdout.strip() else None


# ---- 段 0：読み取り ----

def parse_wbs(text):
    stages, items, cur = {}, [], None
    for line in text.splitlines():
        m = re.match(r'^### (W\d) (.+)$', line)
        if m:
            cur = m.group(1)
            stages[cur] = {'id': cur, 'title': m.group(2), 'exit': None}
            continue
        if cur and line.startswith('出口：'):
            stages[cur]['exit'] = line[len('出口：'):]
        m = re.match(r'^\| (W\d-\d+) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|$', line)
        if m:
            wid, work, out, dep, done = m.groups()
            items.append({'id': wid, 'stage': wid.split('-')[0], 'work': work, 'output': out,
                          'dep_raw': dep, 'done': done})
    ids = {i['id'] for i in items}
    for i in items:
        deps = []
        if i['dep_raw'].strip() != 'なし':
            for tok in re.split(r'[、,]', i['dep_raw']):
                tok = tok.strip()
                r = re.match(r'^(W\d)-(\d+)〜(W\d)-(\d+)$', tok)
                if r and r.group(1) == r.group(3):
                    deps += [f'{r.group(1)}-{n}' for n in range(int(r.group(2)), int(r.group(4)) + 1)]
                elif re.match(r'^W\d-\d+$', tok):
                    deps.append(tok)
        i['deps'] = [d for d in deps if d in ids]
        refs = re.findall(r'(?:FR|NFR)-\d+|\bA\d\d\b|\bO\d\d\b|REQ-\d+', i['work'] + ' ' + i['done'])
        i['refs'] = sorted(set(refs), key=refs.index)
    # 段階の表がない W7 は移さない（migration.md 2 章）
    stages = {k: v for k, v in stages.items() if any(i['stage'] == k for i in items)}
    return stages, items


def load_status(path):
    import yaml  # PyYAML
    return {e['id']: e for e in yaml.safe_load(open(path, encoding='utf-8'))}


def body_hash(body):
    return hashlib.sha256(body.strip().encode('utf-8')).hexdigest()


def finish(body, source):
    return f'{body.strip()}\n\n<!-- loomake-wbs: source={source} generated={body_hash(body)} -->'


def stage_issue(st, items, source):
    children = [i['id'] for i in items if i['stage'] == st['id']]
    exits = re.findall(r'\bA\d\d\b', (st['exit'] or '').split('。')[0])
    lines = ['### WBS ID', st['id'], '', '### 段階', st['title'], '', '### 出口']
    if exits:
        lines += [f'- [ ] {a}' for a in exits]
        lines += ['- [ ] 前の段階までの必須の回帰確認（WBS 4 章の冒頭）']
        rest = (st['exit'] or '').split('。', 1)[1:] if st['exit'] else []
        if rest and rest[0].strip():
            lines += ['', rest[0].strip()]
    elif st['id'] == 'W6':
        lines += ['- [ ] W6-3 の別リポジトリでの導入検証（初回配布完了）']
    else:
        lines += ['- [ ] 配下の作業項目の完了条件がすべて確認できた（段階 1 の前半。受入シナリオの出口はない）']
    lines += ['', '### 閉じ方',
              '配下の sub-issue がすべて閉じたことではなく、上の出口が確認できたときに `completed` で閉じる（docs/wbs/migration.md 3.2）。',
              '', f'作業項目：{"、".join(children)}']
    return {'id': st['id'], 'title': f"[{st['id']}] {st['title']}", 'body': finish('\n'.join(lines), source)}


def item_issue(i, status, source):
    lines = ['### WBS ID', i['id'], '', '### 作業', i['work'], '', '### 成果物', i['output'], '',
             '### 完了条件', i['done']]
    if i['refs']:
        lines += ['', '### 参照'] + [f'- {r}' for r in i['refs']]
    st = status.get(i['id'])
    if st and st['assessment'] == 'partial':
        lines += ['', '### 移行時の現状', '関連する実装（移行時点の記録。作業が進んでも書き換えない）：']
        lines += [f'- {e}' for e in st.get('evidence') or []]
        if st.get('missing'):
            lines += ['', f"完了条件に足りないもの：{st['missing']}"]
    title_work = re.split(r'[。]', i['work'])[0]
    if len(title_work) > 60:
        title_work = title_work[:60] + '…'
    return {'id': i['id'], 'title': f"[{i['id']}] {title_work}", 'body': finish('\n'.join(lines), source)}


# ---- GitHub の既存の状態 ----

def existing_issues(repo):
    found, page = {}, 1
    while True:
        batch = gh([f'repos/{repo}/issues?labels={LABEL}&state=all&per_page=100&page={page}'])
        if not batch:
            return found
        for iss in batch:
            if 'pull_request' in iss:
                continue
            m = re.match(r'^\[(W\d(?:-\d+(?:\.\d+)?)?)\]', iss['title'])
            if m:
                found.setdefault(m.group(1), []).append(iss)
        page += 1


def generated_part(body):
    """本文のうち、末尾の印までを返す。印のあとに GitHub やツールが足した署名などは比べない"""
    m = MARK.search(body or '')
    return (body or '')[:m.end()].strip() if m else None


def can_rewrite(iss, plan):
    """前回生成したときのままなら True。本文は印の generated= と照合する。
    タイトルは前回の値を残していないので、生成するタイトルと同じときだけ書き換えてよいとする
    （人が直したタイトルは書き換えない。移行元は固定版なので、生成するタイトルは変わらない）"""
    body = iss.get('body') or ''
    m = MARK.search(body)
    if not m or iss['title'] != plan['title']:
        return False
    return body_hash(body[:m.start()]) == m.group(2)


CLOSE_MARK = '<!-- loomake-wbs: initial-status=done -->'


def close_state(repo, number):
    """初期状態が done の Issue を閉じる処理がどこまで済んだかを返す。
    人が開き直した Issue（reopened の記録がある）は閉じない"""
    events = gh([f'repos/{repo}/issues/{number}/events?per_page=100']) or []
    if any(e.get('event') == 'reopened' for e in events):
        return 'reopened'
    comments = gh([f'repos/{repo}/issues/{number}/comments?per_page=100']) or []
    return 'commented' if any(CLOSE_MARK in (c.get('body') or '') for c in comments) else 'none'


# ---- 実行 ----

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', required=True)
    ap.add_argument('--wbs', default='docs/wbs/baseline-v1.4.md')
    ap.add_argument('--status', default='docs/wbs/initial-status.yaml')
    ap.add_argument('--source', default='docs/wbs/baseline-v1.4.md@HEAD', help='本文に残す移行元（例：docs/wbs/baseline-v1.4.md@<commit>）')
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--apply', action='store_true')
    ap.add_argument('--out', help='WBS ID と Issue 番号の対応を書き出す JSON')
    a = ap.parse_args()

    stages, items = parse_wbs(open(a.wbs, encoding='utf-8').read())
    status = load_status(a.status)
    missing = [i['id'] for i in items if i['id'] not in status]
    if missing:
        sys.exit(f'初期状態にない作業項目があります：{missing}')
    plans = [stage_issue(s, items, a.source) for s in stages.values()] + \
            [item_issue(i, status, a.source) for i in items]
    have = existing_issues(a.repo)
    dup = {k: [x['number'] for x in v] for k, v in have.items() if len(v) > 1}
    if dup:
        sys.exit(f'同じ WBS ID の Issue が 2 件以上あります。中断します：{dup}')

    report = {'create': [], 'update': [], 'unchanged': [], 'conflict': [], 'close': [],
              'sub_issue': 0, 'blocked_by': 0}
    num, nid = {}, {}

    if a.apply and gh([f'repos/{a.repo}/labels/{LABEL}'], ok404=True) is None:
        gh([f'repos/{a.repo}/labels'], {'name': LABEL, 'color': '0e8a16',
                                         'description': 'WBS の作業項目（docs/wbs.md から移したもの）'})

    # 段 1：作成（段階 → 作業項目の順）
    for p in plans:
        cur = (have.get(p['id']) or [None])[0]
        if cur is None:
            report['create'].append(p['id'])
            if a.apply:
                iss = gh([f'repos/{a.repo}/issues'], {'title': p['title'], 'body': p['body'], 'labels': [LABEL]})
                num[p['id']], nid[p['id']] = iss['number'], iss['id']
            continue
        num[p['id']], nid[p['id']] = cur['number'], cur['id']
        if cur['title'] == p['title'] and generated_part(cur.get('body')) == p['body'].strip():
            report['unchanged'].append(p['id'])
        elif can_rewrite(cur, p):
            report['update'].append(p['id'])
            if a.apply:
                gh([f"repos/{a.repo}/issues/{cur['number']}", '-X', 'PATCH'], {'title': p['title'], 'body': p['body']})
        else:
            report['conflict'].append(f"{p['id']}（#{cur['number']}）")

    # 段 2：関連付け。--dry-run でも、既にある Issue は今の関係を読み、足す分だけを数える
    item_ids = [i['id'] for i in items]
    sub_cache = {}

    def subs_of(parent):
        if parent not in num:
            return set()
        if parent not in sub_cache:
            sub_cache[parent] = {s['id'] for s in gh([f"repos/{a.repo}/issues/{num[parent]}/sub_issues?per_page=100"]) or []}
        return sub_cache[parent]

    for i in items:
        parent = i['stage']
        if i['id'] in nid and nid[i['id']] in subs_of(parent):
            continue
        report['sub_issue'] += 1
        if a.apply:
            gh([f"repos/{a.repo}/issues/{num[parent]}/sub_issues", '-X', 'POST'], {'sub_issue_id': nid[i['id']]})
    for i in items:
        if not i['deps']:
            continue
        cur = set()
        if i['id'] in num:
            cur = {b['id'] for b in gh([f"repos/{a.repo}/issues/{num[i['id']]}/dependencies/blocked_by?per_page=100"]) or []}
        for d in i['deps']:
            if d in nid and nid[d] in cur:
                continue
            report['blocked_by'] += 1
            if a.apply:
                gh([f"repos/{a.repo}/issues/{num[i['id']]}/dependencies/blocked_by", '-X', 'POST'], {'issue_id': nid[d]})

    # 初期状態が done の作業項目は completed で閉じる。前回の実行が途中で止まっていても続きから閉じるが、
    # 人が開き直した Issue は閉じない
    open_now = {k: v[0]['state'] == 'open' for k, v in have.items()}
    for i in items:
        st = status[i['id']]
        if st['assessment'] != 'done':
            continue
        created = i['id'] in report['create']
        if not created and not open_now.get(i['id'], False):
            continue
        state = 'none' if created else close_state(a.repo, num[i['id']])
        if state == 'reopened':
            report.setdefault('reopened', []).append(i['id'])
            continue
        report['close'].append(i['id'])
        if a.apply:
            if state == 'none':
                ev = '\n'.join(f'- {e}' for e in st.get('evidence') or [])
                gh([f"repos/{a.repo}/issues/{num[i['id']]}/comments"],
                   {'body': f'移行時の初期状態（docs/wbs/initial-status.yaml）で完了と判定した根拠：\n\n{ev}\n\n{CLOSE_MARK}'})
            gh([f"repos/{a.repo}/issues/{num[i['id']]}", '-X', 'PATCH'], {'state': 'closed', 'state_reason': 'completed'})

    if a.out and a.apply:
        json.dump({k: num[k] for k in [s for s in stages] + item_ids}, open(a.out, 'w'), indent=2, ensure_ascii=False)
    report['issues'] = len(plans)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report['conflict']:
        sys.exit(1)


if __name__ == '__main__':
    main()
