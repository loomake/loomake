# delivery スキルに all-os ラベルと scratchpad の規則を足す

1. やったこと：利用者が承認した規則 2 点を `.agents/skills/delivery/SKILL.md` に足し、`docs/dev/ci.md` にも同じ規則を 1 行で書いた。1 点目は、試験・scripts・workflow を変える L2 の PR に `ci:all-os` ラベルを付け、Windows・macOS の CI も成功してからマージすること。PR の必須チェックの試験は ubuntu でしか流れないため、PR #212 で足した試験が Windows の checkout（CRLF）で落ちるのを見逃し、後追いの PR #225 が要った。2 点目は、サブエージェントの下書きを scratchpad の担当別フォルダに置くこと。2 つの担当が scratchpad 直下の pr.md を共用し、PR #212 の本文が数分のあいだ別の PR の内容で上書きされた。
2. verify の結果：change はない（規則の文書だけ）。`pnpm -s lint` と `tests/doc-links.test.ts` は成功した。
3. 残っている確認事項・仮定：2026-10-31 の時点で、main の Windows の CI が 2 つの原因で落ちている。`tests/domain-mutations-workflow.test.ts` が jq の CRLF で毎回落ちるもの（Issue #232）と、partition の試験が片付けの EPERM でときどき落ちるもの（Issue #229）。管理役の決定により、既知の失敗を例外にする規則は足さず、2 つの原因を直す。直るまでは、ラベルを付けた L2 の PR が Windows の失敗で止まることがある。L3 で `ci:all-os` を必須にする自動検査は、ci.md の既存の方針どおり今回も入れていない。
4. 次にやること：管理役がマージを判断する。#232 と #229 は、それぞれ別の担当が修正の PR を作成中。
