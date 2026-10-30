# delivery補助のSIGINT試験を修復する計画

## 対象と現在の状態

main `751a8a1b6ffca673f44f2fa272b9029a667bf12b`の[CI run 40968703839 / Windows shard 2](https://github.com/loomake/loomake/actions/runs/40968703839/job/123779684746)で、`tests/delivery-ask-opus.test.ts`のSIGINT試験が772msで失敗した。記録されたエラーはfixtureを削除するfinallyのEPERMで、同shardは856成功・1失敗・既存5 skip、ほか50ファイルは成功した。CIはNode24.22.1、今回の先行観測はNode24.21.0/Linux arm64である。

これは開発補助試験の修復案であり、製品の振る舞いを変えるchangeではない。[AGENTS.md](../../AGENTS.md)の開発の仕組みに関する例外に従う。F-SIGINT-01は[4条件付きA回答](https://github.com/loomake/loomake/pull/156#issuecomment-6511113103)で採用された。計画commit `136aa62`で文書と承認案を整合し、承認範囲のテスト修復と追加回帰を実装した。製品helper・設定は変えない。追加Opus最終評価の回数に関する判断は別に残る。Issue116の断続的な時間切れ、品質生成器の起動判定、C001、進行中のarchive、Issue153の残事項は修正範囲に含めない。

## 観測と原因仮説

現行試験は、偽プロセスが準備ファイルを書いたあと、wrapper自身へ `process.kill(process.pid,'SIGINT')` を送る。Windowsのプログラムによるkillは、端末のCtrl+Cと同じ経路ではない。[Nodeのsignal仕様](https://nodejs.org/docs/latest-v24.x/api/process.html#signal-events)によると、この呼出しはWindowsでは対象を強制終了する。[Microsoftのcurrent directory仕様](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setcurrentdirectory)では、実行中のプロセスが使うcwdを削除できない。

そのため、wrapperがhandlerを実行する前に終了し、偽プロセスがfixtureのcwdを保持して、finallyが元の終了状態のassertionをEPERMで覆った可能性がある。main751のCIログにはwrapperのstatus/PID/manifestがなく、実際のWindowsでこの因果関係を再現したとは報告しない。一時的なファイルhandle等の別要因も未確定である。製品helperが正常だと過去CIやモデルの判断だけで断定しない。

先行main `abe57776fb05f9c495640379c2662b13c21d7e69`の[run40967196223 / Windows job123774571493](https://github.com/loomake/loomake/actions/runs/40967196223/job/123774571493)も今回取得して確認した。同じSIGINT試験は486msで失敗し、主エラーはline226のstatus期待0・実値1で、844成功・1失敗・既存5 skipだった。このjobのログにEPERMはなく、main751のcleanup EPERMとは報告された主エラーが違う。同じ試験の失敗が先行runにもあることと、EPERMそのものの再現を区別する。

Linuxの限定観測では、実helperと同一の偽fixtureに対するself-SIGINTはwrapper0、子のexit/close、未実施manifest、子の停止を確認できた。比較用にwrapperをSIGKILLで止めると、manifestなしで偽プロセスが残り、Linuxではそのcwdを削除できた。後者はWindowsのEPERM再現ではない。観測用の所有子はすべて停止済みである。

[Nodeのclose仕様](https://nodejs.org/download/release/v24.21.0/docs/api/child_process.html#event-close)は子の終了とstdioの閉鎖を区別し、現helperはcloseを待つ。この待機までwrapperが到達するかを今回の試験で確かめる。[rmSyncのforce](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsrmsyncpath-options)は不存在を許容する指定で、EPERMを無視する指定ではない。削除のretryや例外の握り潰しだけで合格にはしない。

## Opus設計と工程の未達

難しい不具合の経路としてCodexが先行観測し、管理役がClaude CodeのOpusへ調査・比較・設計を依頼した。Codexの実モデル識別子は取得できず不明と記録する。

| 実行 | 確認できた状態 |
|---|---|
| 先行session `b2b53a12` | API guard error、reportなし、未実施。Opus工程の成功には数えない |
| session `773e82ab-6ea6-46f3-9078-1c31c7628b15` | actual `claude-opus-5-5`、helper exit0/ok:true、拒否0、読取ツールのみ・MCP0、113.749秒。調査・比較・設計の成果物あり。今回のOpus評価1/2として数える |
| 初回調査の独立性 | 証明できない。Codex資料のReadはevent81、最終assistant本文はevent113で、それ以前の公開見解がない。事前保存だけの欠落とせず、独立性のない調査・設計として扱う |
| [外部設計レビュー6511060043](https://github.com/loomake/loomake/pull/156#issuecomment-6511060043) | Claude Code / actual claude-opus-5-5。sessionは不明。初回773に加わる2回目のOpus評価であり、確認代行の別枠へ移さない |
| [外部実装レビュー6511719551](https://github.com/loomake/loomake/pull/156#issuecomment-6511719551) | actual claude-opus-5-5、head9a84ad7、sessionは不明。実評価の3回目として数え、既存枠をリセットしない |
| 修正後headの最終レビュー | 未実施。実評価は合計3回で、次の起動は4回目となる。R156-REVIEW-01は追加1回・合計4回の扱いへの判断待ちで、承認済みとはしない |

成果物の「Codex資料を読む前に初期見解を投稿した」という自己申告は、eventの順序で裏付けられないため採用しない。内部thinkingを工程の証拠へ読み替えず、抽出・添付しない。helperのok:trueは実行結果の確認であり、工程全体の完了を意味しない。失敗した先行呼出しを成功とせず、初回の1枠も取り消さない。旧PR152のOpus評価2/2やその後の人の受入・別枠自動Codexレビューは、この新しい故障の調査でリセットしない。

[工程規約4章](agent-workflow.md#4-独立した調査とレビュー)は次のように定める。

> 先行担当の結論や推奨修正は渡さず、独立した見解を先に保存する。

[deliveryスキル](../../.agents/skills/delivery/SKILL.md)は次のように定める。

> 正本に従う工程省略・担当代替は、利用者が明示的に承認した範囲に限り、その承認元を記録する。

FのA回答は今回の調査・設計を独立性なしとして扱い、独立調査工程そのものを省略する決定である。AGENTS.mdがすべての試験編集を一律に承認制にしている、というOpus本文の説明は採用しない。禁止されている試験弱化・skip・期待値や設定の無承認変更は、引き続き行わない。

## F-SIGINT-01の決定と別に残る最終評価

| ID | 決定 | 回答者 | 回答日 | 承認元 |
|---|---|---|---|---|
| F-SIGINT-01 | A、以下の4条件付きで採用 | rrr-www。利用者rrr-xxxの指示をClaude Codeが転記 | 2026-10-30 JST | [明示回答6511113103](https://github.com/loomake/loomake/pull/156#issuecomment-6511113103) |

1. 今回のOpus調査・設計は独立性のないものとし、独立調査そのものの省略を承認元付きで記録する。
2. Windowsのnative OS signal試験は実質的な除外である。it.skipIf(win32)でskip件数に出し、「新しいskipを加えない」という旧説明を撤回する。このWindows skip1件は上のURLで個別承認済みである。
3. assertionとcleanupの例外を両方保持し、wrapperへkillSignal:'SIGKILL'を追加する。10000msと元の期待値・3000ms・rmSync指定を保持する。Windows PID再利用への対策も可能な最小範囲で反映する。
4. 先行main abe5777の同じSIGINT試験失敗を証跡へ加える。取得ログで確認した主エラーの違いは、そのまま記録する。

この回答を受け、計画整合後のCodex実装・試験は進める。Fを未回答へ戻さず、工程省略や実装範囲を再質問しない。外部レビュー6511060043自体はFに回答していないが、後の6511113103は明示回答である。

回答は当時の最終レビューを2/2と記したが、初回773・外部設計レビュー6511060043・外部実装レビュー6511719551で、実評価は既に合計3回である。このAを追加評価の例外承認へ読み替えず、次の4回目の起動を止める。管理役はR156-REVIEW-01として追加1回・合計4回の扱いだけを別途確認する。既存3回を取り消したり、確認代行の別枠へ移したりしない。受入は未実施で、新headの全OS CIと最終レビュー条件を残す。

外部レビュアーはLinux Node24.21で32試験成功・9連続成功・listener除去mutationの2失敗を報告した。これはレビュアーの申告であり、今回の担当が実行した結果ではない。新しいpatchやWindowsの成功へ流用しない。

## 提案する試験の差分

変更対象は `tests/delivery-ask-opus.test.ts` だけ。helperや製品source、引数、公開JSON、依存、設定を変えない。偽プロセスがPIDを先に保存してから準備を通知し、次の2経路で実際に登録されたlistener・子の停止・manifestを確認する。

| 経路 | 検証するものと限界 |
|---|---|
| 全OSのhandler event | wrapper内のprocess.emit('SIGINT')から実listener、実stopChild、実child close、実manifestへ進む。Windowsのtaskkill経路も使うが、native console Ctrl+Cの配送は検証しない |
| POSIXの実OS signal | 元のprocess.kill(process.pid,'SIGINT')と元の試験名を保持。Windowsではit.skipIfでこのcaseを明示skipし、件数にも出す |

全OS handler caseを追加し、元のnative signal caseはPOSIXで実行、Windowsで明示skipにする。Windowsで従来の実signal入力を実行しないというカバレッジ変更を隠さず、Fの承認範囲として扱う。ほかの既存skip指定は変えない。handler eventはnative Ctrl+Cの配送試験を代替しない。

PID検査はkill(pid,0)とLinux/macOSのzombie判別を使い、不明なエラーを停止済みへ変換しない。正常結果を確認したあと、後片付け前にPIDが生存していないことを追加assertionにする。失敗時のcleanupは、このfixtureが保存した正のPIDを対象候補とし、再照合する。Windowsでは固定PowerShell scriptからCIMのCommandLineを取得し、spawnに渡したfixtureのfake.mjsパスが独立した引数として一致するときだけtaskkill /PID /Fを使う。/Tは使わず、パス・PIDはenvのデータとして渡し、script文字列へ埋め込まない。照合不能・不一致は停止命令を出さず失敗にする。全nodeプロセスや他worktreeを止めない。後片付けの待機上限には既存input.timeoutMs（3000ms）を使い、正常性のassertionをretryで通す方法にはしない。既存rmSyncの指定はそのまま残す。内側のassertionと所有子cleanup、外側withRepoのrmSyncをそれぞれwithCleanupで扱い、単一エラーは同じ例外、多重エラーは入れ子のAggregateError.errorsで全件保持する。cleanup失敗も握り潰さない。

このguardはCIM照合から停止までを原子的に固定するものではなく、その間の競合まで解消したとは主張しない。固定scriptのWindows実行とguardの正常/不一致/取得失敗は新headのCIで確認する。製品helper内の通常のtaskkill経路は今回変更しない。

承認時のfull patchは計画commit `136aa62`とignored `.loomake/repair-proposal.patch`に保持した。現行実装は[テスト本体](../../tests/delivery-ask-opus.test.ts)を参照する。実装時には承認案に加えて多重エラー保持・実際の所有子cleanup・Windowsの不一致PID拒否を検査する回帰を追加した。外側withRepoの削除まで含むエラー集約と、通常の正常性assertion後に生存PIDを拒否する位置を維持している。

## 維持するassertionと期限

| 現行の条件 | 提案後 |
|---|---|
| wrapper statusは0 | 0を保持。stderrを失敗時の診断へ加え、errorなし・signal:nullも追加確認 |
| resultはok:false、reasonに中断 | 同じ期待値を両caseで保持 |
| manifestはok:false | 同じ期待値を両caseで保持 |
| fixtureのtimeoutMsは3000 | 数値・実行上限を保持 |
| wrapper spawnSync timeoutは10000 | 数値を保持し、承認されたkillSignal:SIGKILLを追加。SIGTERM listenerによる無期限待ちを防ぐ |
| rmSync recursive:true/force:true | 指定を保持。maxRetriesや例外無視を追加しない |
| skipと設定 | Windowsのnative signal1件だけを承認済み明示skipへ変更。ほかの既存skip・lint/型/品質設定を保持 |
| 子が本当に止まったか | 正常assertion後・失敗時cleanup前にPID生存falseを追加。cleanup成功だけでPASSにしない |

## 実装と検証の手順

以下は承認後の実装・検証項目である。今回の担当によるローカル実測と、未実施のWindows/最終レビューを下で区別する。

| 確認 | 期待する証拠 |
|---|---|
| 通常回帰 | Linux/macOSはhandler eventと実signalの両case、Windowsはhandler eventで元の3期待値とPID停止を確認。対象fileのほかの試験も保持 |
| mutation 1: SIGINT listener登録を除去 | reasonが中断でなくなるかwrapperが正常終了せず、同じ試験が失敗する。元に戻すと成功することを対に記録 |
| mutation 2: stopChildをno-op | 成功として受け入れず、正常status/resultまたはPID停止検査が破れることを確認。10000msのSIGKILLで終了し、合格にしないことを確認する。専有scratchの外側watchdogと所有PID記録も暴走回収用に残す |
| 例外保持の回帰 | assertion・所有子cleanup・外側rmの3例外とcleanup単独失敗が失われないことを確認する |
| 所有PID guardの回帰 | 実際の偽プロセスだけを停止し、Windowsで別commandlineの所有テスト子を誤停止しないこと、照合失敗をエラーにすることを確認する |
| PID検査の負例 | interrupted result/manifestだけを満たして子を残す専有fixtureを使い、生存falseのassertionが失敗することと、後段の所有子cleanupを別に確認する |
| mutationの安全な実行 | 追跡helper・設定は変えず、専有scratch copyを使う。watchdogは合否の期限を延ばすためでなく暴走回収用とし、対象PID/子孫と回収結果を保存する。生存assertionを削除した試験で代用しない |
| 型・lint・全OS CI | 修正した同一headで確認。OS/shard別の実施件数と既存skipを区別し、承認されたWindows skip1件以外の変更・期限緩和がないことを照合 |
| native Windowsの受入 | handler eventの実childkill/manifest/PID停止とEPERMなしを新CIで確認。子が停止済みでもEPERMが残れば別要因として記録し再設計。削除retryで隠さない |
| 最終レビュー | 実評価は3回済みで、次の4回目の起動はR156-REVIEW-01の判断まで保留する。許可後は設計・実装とは別の新Opus sessionで対象head・actual model・結果・拒否・未解決事項を記録する |

過去CIやLinuxの比較だけでWindows修復済みとは報告しない。新しい対象headの必須CI・全OS/shardを確認し、重大な未解決事項があれば規約に従って人へ提示する。

## 証跡の所在と今回の検査

公開資料はこの設計と作業記録に限定し、内部thinking・認証・生envを含めない。管理役が保持するignored資料は `.loomake/investigation/` のCI抜粋・Issue153/116 snapshot・Linux観測、`.loomake/second-opinion/codex-findings.md`、`.loomake/claude/773e82ab-6ea6-46f3-9078-1c31c7628b15/result.md` とsanitized実行情報である。Opusの原文は変更しない。

計画commitではyomiyasu、diff/applycheckと既存test/helper/configのbyte保持を確認した。承認案をテストへ適用後、今回の担当がNode24.21.0/Linux arm64で対象34試験・型・lintの成功を確認した。ここにはWindows専用のPID拒否回帰は含まれず、その実行は新headの全OS CIを待つ。

専有scratch copyのmutationも新たに実行した。SIGINT listener除去は2失敗、stopChild no-opは1失敗で約10.35秒にETIMEDOUTを検出し、外側watchdogは発火しなかった。例外を上書きする旧finallyへのmutationでは、多重エラー保持回帰が1失敗となった。3実行とも対象childの残存はなく、正常34試験成功と対に記録した。これは外部レビュアーの32件/9連続という申告とは別の実測である。

main d5aa30dの[CI40973889686 / Windows job123797067291](https://github.com/loomake/loomake/actions/runs/40973889686/job/123797067291)も取得した。同じSIGINT試験でstatus期待0・実値1、856成功・1失敗・既存5 skipであり、このjobにEPERMはない。修正前の別headの証拠として扱い、ローカルの新実装やWindows修復成功へ読み替えない。

実装head `0949a5d`の最初の通常verifyはexit1、1,412成功・25失敗・既存8 skipだった。TMPDIRをworktree内に置いたため、extensionlessなCommonJS fixtureのESM継承18件、Unix socketの長いパス5件、mountの実行権限判定1件、上位Gitの発見1件に分類した。内外のprobeで、0644ファイルのX_OK、extensionless Node、socket bind、Git上位探索の違いを測定し、失敗結果と全25件の分類を保持した。コードや期待値の変更で通したものではない。

追跡cleanの状態でmain `d5aa30d`を通常mergeし、統合head `107cba0`を用意した。PR155の主仕様・archiveの取り込みはmain由来の差分で、この修復固有の差分とは分ける。実装0949と統合107のテストはSHA256 `51d0ab9d105fb79caac1f30c22c2ac9375e40279dadada7f396285a92895af5f`で一致し、openspec全体は統合main d5とbyte一致する。

短い専有/tmpをrealpath・Git上位なし（rev-parse128）で確認し、CJS・権限・socketの前提も照合してから、統合headで1回だけ通常verifyを再実行した。exit0、1,437成功・0失敗・既存8 skip、約82.65秒で、以前失敗した25件もすべて成功した。同じ統合headのstrict主仕様は29/29・exit0。これは新treeと実行前提の訂正を根拠とする検証で、失敗した最初の実行を成功へ読み替えない。

9aのnative CI結果は次節に記録する。追加の修正headでは管理役による全OS CIと、R156-REVIEW-01の回数判断後の最終Opusを待つ。前の記録commitではテスト・規範を変えず、上の検証元との一致を残した。製品helper・設定・既存の期待値と期限を保持し、ローカル成功だけで最終受入とは報告しない。


## Windowsのpositive guard失敗と照合・受渡しの修正

[9aのCI40977422954 / Windows shard2 job123808803025](https://github.com/loomake/loomake/actions/runs/40977422954/job/123808803025)を今回取得した。唯一の失敗は「fixtureの所有子を停止してから削除できる」で、PowerShellのexact argument照合がProcess fixture argument mismatchを返した。859成功・1失敗・6 skipであり、6件には個別承認済みのWindows native signal skip1件を含む。handler eventは749ms、negative PID guardは979msで成功したが、positive guardは1294msで失敗した。この結果をWindows修復済みとは扱わない。

修正はテストsourceの2行に限定した。まず、固定scriptの受渡しを-Commandの生文字列から-EncodedCommandのUTF-16LE/Base64へ変えた。[Microsoft一次資料](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1#-encodedcommand-base64encodedcommand)が、複雑な引用符を含むcommandの受渡しにこの形式を定めている。

もう1行は照合するfixtureをGetFullPathで再変換せず、envで受けた文字列そのものとした。spawnのprefixArgsとcleanup envには、同じ `join(cwd, '.loomake/fake.mjs')` のabsoluteな引数を渡している。[.NET Frameworkの一次資料](https://learn.microsoft.com/en-us/dotnet/api/system.io.path.getfullpath?view=netframework-4.8.1)はGetFullPathの短名から長名への展開を明記しているため、渡した引数の表記を照合前に変換する処理を除いた。positive guard自体のcommandlineは未取得で、この変換が今回のnative failureの原因だったと確定したものではない。

この2行を戻すと9aのテストsource全体とbyte一致する。新scriptをencode/decodeしても内容は保持されるが、旧scriptからはexpectedFixtureの代入1行が変わる。exact argumentのregex、env経由のPID/path、未知PIDを停止しない分岐、/Tなし、期限とkillSignal、assertion・cleanupは変更していない。PID/pathの値をscriptへ埋め込まず、未知プロセスのcommandline全文を診断に出す変更も加えていない。

EncodedCommandだけを変更した前段の通常verifyはexit0、1,437成功・0失敗・既存8 skip、約81.23秒だった。最終2行候補ではLinux Node24.21.0/arm64の関連34試験・型・lintが成功した。追加のGetFullPath除去はWindows分岐のため、このLinux試験で実行したとは扱わない。最終head全体は新CIのUbuntu/gateとnative Windowsで確認する。

ローカルWindowsでの再現は未実施であり、quote transportと8.3/長いパスのどちらが原因かは未確定である。同じpositive/negative guardが新headのnative CIで成功することを回復証拠とし、依然失敗するなら実ログから調べる。CIM照合から停止までが非原子的である限界も保持する。

[追加実装レビュー6511719551](https://github.com/loomake/loomake/pull/156#issuecomment-6511719551)は実評価の3回目として記録した。actual claude-opus-5-5で、sessionは不明。外部のLinux34件を6連続・mutation等の結果はレビュアー申告で、今回の担当の実測とは分ける。低優先のPOSIX PID照合と既存timeout/output試験の残留可能性は、今回の修正と分けて管理役へ引き継ぐ。Fは承認済みのまま、次のOpusは合計4回目・追加1回としてR156-REVIEW-01の回答待ちであり、起動していない。
