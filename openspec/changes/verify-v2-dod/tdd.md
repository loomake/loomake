# REQ-136 の改行依存の回帰

Issue #281 の Windows 失敗に対し、tasks 雛形を読む追加検査の改行だけを修理した。旧 it 名・既存の期待値全文・印1件・ci checkbox不在・末尾注記の条件は維持する。

## Red

実配布の format を読み、LF と CRLF だけを変えた入力から同じ行配列・印付き行・末尾注記を得る試験を先に追加した。まだ抽出前の正規化がない状態で `pnpm -s exec vitest run tests/kit-assets.test.ts` を実行し、新しい回帰1件だけが `expected null not to be null` で失敗し、既存30件は成功した。

## Green

kit-assets・実init・package-smokeの3箇所で、抽出入力のCRLFをLFへ正規化した。同じ回帰を含む `pnpm -s exec vitest run tests/kit-assets.test.ts packages/cli/test/init.test.ts` は79件すべて成功した。区切りだけを変える修理ではなく、capture内の行末CRも残さず、LFとCRLFで同じ意味の行配列になることを検査している。

Windows CI の成功はこのLinux実行では代用せず、修理後のheadで3 OSのCIを別に確認する。

実tarballのpackage-smokeは通常のLFで成功した。同じconsumerを再利用したCRLF検証は、init後の改行検査を通過したが、初回に生成した証拠が未commitのため終盤のtrace recordで失敗した。この失敗を成功へ読み替えず、同じtarballを新しいconsumerへ展開してCRLFを検証し直す。

同じ5tarballから新しいconsumerを準備し、展開後のformatの改行だけをCRLFに変えて実行したpackage-smokeは、実initの検査からtrace record/reportまでexit 0で完了した。通常LFとCRLFの成功を別々のfresh consumerで確認し、前の再利用失敗も履歴に残した。
