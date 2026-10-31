# delivery スキルに all-os ラベルと scratchpad の規則を足す

1. やったこと：利用者が承認した規則 2 点を `.agents/skills/delivery/SKILL.md` に足し、`docs/dev/ci.md` にも同じ規則を 1 行で書いた。1 点目は、試験・scripts・workflow を変える L2 の PR に `ci:all-os` ラベルを付け、Windows・macOS の CI も成功してからマージすること。PR の必須チェックの試験は ubuntu でしか流れないため、PR #212 で足した試験が Windows の checkout（CRLF）で落ちるのを見逃し、後追いの PR #225 が要った。2 点目は、サブエージェントの下書きを scratchpad の担当別フォルダに置くこと。2 つの担当が scratchpad 直下の pr.md を共用し、PR #212 の本文が数分のあいだ別の PR の内容で上書きされた。
2. verify の結果：change はない（規則の文書だけ）。`pnpm -s lint` と `tests/doc-links.test.ts` は成功した。
3. 残っている確認事項・仮定：L3 の PR で `ci:all-os` を必須にする検査は、今回も入れていない（ci.md の既存の方針どおり）。ラベルの付け忘れは管理役がマージ前に確かめる。
4. 次にやること：管理役が独立 Opus レビューを依頼し、マージを判断する。Windows の片付けで EPERM が出る試験は、別の Issue で扱う。
