#!/usr/bin/env bash
# Claude Code の statusLine。標準入力の JSON から、モデル名と文脈の使用率を 1 行で出す。
# AI コスト削減（.loomake/handoff/ai-cost-plan-2026-10-31.md 施策 B）。jq には依存しない。
# context_window.used_percentage はセッションの序盤に null のことがある。そのときは「--」を出す。
exec node -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { raw += chunk; });
process.stdin.on("end", () => {
  let data = {};
  try { data = JSON.parse(raw) ?? {}; } catch { data = {}; }
  const model = data.model?.display_name || "?";
  const pct = data.context_window?.used_percentage;
  const used = typeof pct === "number" ? `${Math.round(pct)}%` : "--";
  process.stdout.write(`[${model}] 文脈 ${used}\n`);
});
'
