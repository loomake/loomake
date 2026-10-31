#!/usr/bin/env python3
# トークン使用量を、日本時間の日付・ツール・モデルごとに集計して CSV に書く。
# 出典は開発機のログだけで、他の端末の分は含まない。
#   Claude Code: ~/.claude/projects の loomake 関連（サブエージェントを含む）。message.id で重複を除く。
#   Codex: ~/.codex/sessions の token_usage_record（応答ごと）。モデルは直前の turn_context。input はキャッシュ分を除く。
# 列: day,tool,model,input,cache_write,cache_read,output,requests（数値はトークン数、requests は応答の数）。
# 出力するのは日付・ツール名・モデル名・数値だけで、セッションの本文やパスは書かない。
# 使い方: python3 -I scripts/metrics-tokens.py [--out <path>] [--since YYYY-MM-DD]
#   --out   出力先。無ければ標準出力。親ディレクトリは作る
#   --since この日より前の行を捨てる（既定 2026-10-22）
# 行は (day, tool, model) の順に並べるので、同じログからは同じ出力になる。標準ライブラリだけを使う。
# ログの場所は環境変数 HOME から決める（試すときは HOME を差し替える）。
import argparse
import collections
import datetime
import glob
import json
import os
import re
import sys

HEADER = "day,tool,model,input,cache_write,cache_read,output,requests\n"
# CSV に本文や区切り文字が紛れ込まないよう、モデル名はこの形のものだけを出す。
# 表計算ソフトで数式と読まれないよう、先頭は英字に限る（-・@・=・+ で始まる名前は出さない）
MODEL_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._:\-\[\]/@]*$")


def jst_day(ts):
    t = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    return (t + datetime.timedelta(hours=9)).strftime("%Y-%m-%d")


def num(v):
    # 整数でない値は 0、負の値も 0 に丸める
    return max(v, 0) if isinstance(v, int) and not isinstance(v, bool) else 0


def lines(path):
    try:
        with open(path, errors="replace") as f:
            yield from f
    except OSError:
        return


def collect(home):
    agg = collections.defaultdict(lambda: [0, 0, 0, 0, 0])

    def add(key, i, cw, cr, o):
        a = agg[key]
        a[0] += i
        a[1] += cw
        a[2] += cr
        a[3] += o
        a[4] += 1

    seen = set()
    for f in sorted(glob.glob(f"{home}/.claude/projects/*loomake*/**/*.jsonl", recursive=True)):
        for line in lines(f):
            if '"usage"' not in line:
                continue
            try:
                d = json.loads(line)
            except ValueError:
                continue
            m = d.get("message") if isinstance(d, dict) else None
            if not isinstance(m, dict):
                continue
            u, mid, ts = m.get("usage"), m.get("id"), d.get("timestamp")
            if not isinstance(u, dict) or not isinstance(mid, str) or not mid or mid in seen or not isinstance(ts, str):
                continue
            model = m.get("model") or ""
            if not isinstance(model, str) or model.startswith("<"):
                continue
            seen.add(mid)
            try:
                key = (jst_day(ts), "claude-code", model)
            except ValueError:
                continue
            add(key, num(u.get("input_tokens")), num(u.get("cache_creation_input_tokens")),
                num(u.get("cache_read_input_tokens")), num(u.get("output_tokens")))

    for f in sorted(glob.glob(f"{home}/.codex/sessions/**/*.jsonl", recursive=True)):
        model = None
        for line in lines(f):
            try:
                d = json.loads(line)
            except ValueError:
                continue
            if not isinstance(d, dict):
                continue
            t, p = d.get("type"), d.get("payload")
            if not isinstance(p, dict):
                continue
            if t == "turn_context":
                model = p.get("model") if isinstance(p.get("model"), str) else None
            elif t == "token_usage_record" and model:
                u = p.get("usage")
                ts = d.get("timestamp")
                if not isinstance(u, dict) or not isinstance(ts, str):
                    continue
                c = num(u.get("cached_input_tokens"))
                try:
                    key = (jst_day(ts), "codex", model)
                except ValueError:
                    continue
                add(key, max(num(u.get("input_tokens")) - c, 0), num(u.get("cache_write_input_tokens")),
                    c, num(u.get("output_tokens")))
    return agg


def render(agg, since):
    out = [HEADER]
    for k in sorted(agg):
        day, tool, model = k
        if day < since or not MODEL_RE.match(model):
            continue
        out.append(",".join([day, tool, model, *(str(v) for v in agg[k])]) + "\n")
    return "".join(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description="トークン使用量を日本時間の日付・ツール・モデルごとに CSV にする")
    ap.add_argument("--out", help="出力先のパス。無ければ標準出力")
    ap.add_argument("--since", default="2026-10-22", help="この日（YYYY-MM-DD）より前を捨てる。既定 2026-10-22")
    a = ap.parse_args(argv)
    try:
        since = datetime.date.fromisoformat(a.since).isoformat()
    except ValueError:
        ap.error(f"--since は YYYY-MM-DD で指定してください: {a.since}")
    text = render(collect(os.path.expanduser("~")), since)
    if a.out:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        tmp = a.out + ".tmp"
        with open(tmp, "w", newline="") as f:
            f.write(text)
        os.replace(tmp, a.out)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
