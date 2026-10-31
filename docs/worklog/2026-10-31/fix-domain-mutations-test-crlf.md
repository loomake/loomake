# 変異試験の要約の試験で Windows の CRLF をそろえる

1. やったこと：main の Windows の CI で、tests/domain-mutations-workflow.test.ts の 2 件が落ちていた。Git Bash の jq が要約を CRLF で書くため、期待する文字列と行末が合わなかった。試験の読み取り側で、要約の行末を LF にそろえるようにした。期待値と workflow は変えていない。survived.json は jq が JSON として書くので、文字列の値に CR は入らない。JSON.parse で読めば行末の影響も受けない。
2. verify の結果：手元（Linux）で `pnpm exec vitest run tests/domain-mutations-workflow.test.ts` は 5 件とも合格した。eslint と typecheck も合格した。Windows と macOS は PR の CI（ci:all-os）で確かめる。
3. 残っている確認事項・仮定：原因は、#215 を ci:all-os なしでマージした見落とし。規則の追記は PR #228 で行う。
4. 次にやること：CI がすべて合格したら、Fable の独立レビューとマージの判断を待つ。
