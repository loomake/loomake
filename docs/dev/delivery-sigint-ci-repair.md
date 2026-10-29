# delivery補助のSIGINT試験を修復する計画

## 対象と現在の状態

main `751a8a1b6ffca673f44f2fa272b9029a667bf12b`の[CI run 40968703839 / Windows shard 2](https://github.com/loomake/loomake/actions/runs/40968703839/job/123779684746)で、`tests/delivery-ask-opus.test.ts`のSIGINT試験が772msで失敗した。記録されたエラーはfixtureを削除するfinallyのEPERMで、同shardは856成功・1失敗・既存5 skip、ほか50ファイルは成功した。CIはNode24.22.1、今回の先行観測はNode24.21.0/Linux arm64である。

これは開発補助試験の修復案であり、製品の振る舞いを変えるchangeではない。[AGENTS.md](../../AGENTS.md)の開発の仕組みに関する例外に従う。F-SIGINT-01は[4条件付きA回答](https://github.com/loomake/loomake/pull/156#issuecomment-6511113103)で採用された。まず文書と未適用patchを整合し、その計画commit後に承認範囲のテスト修復を実装する。製品helper・設定は変えない。追加Opus最終評価の回数に関する判断は別に残る。Issue116の断続的な時間切れ、品質生成器の起動判定、C001、進行中のarchive、Issue153の残事項は修正範囲に含めない。

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
| 実装後の最終レビュー | 未実施。通常の評価枠は2/2使用済み。次の起動は実際には3回目なので、回数の扱いについて別途判断を得るまで開始しない |

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

回答は今後の最終レビューを2/2と記すが、実数は初回773と外部設計レビューで既に2回である。このAを3回目評価の例外承認へ読み替えず、追加起動を止める。管理役は実装headとCIをそろえて、この回数の扱いだけを別途確認する。既存2回を取り消したり、確認代行の別枠へ移したりしない。受入は未実施で、新headの全OS CIと最終レビュー条件を残す。

外部レビュアーはLinux Node24.21で32試験成功・9連続成功・listener除去mutationの2失敗を報告した。これはレビュアーの申告であり、今回の担当が実行した結果ではない。新しいpatchやWindowsの成功へ流用しない。

## 提案する試験の差分

変更対象は `tests/delivery-ask-opus.test.ts` だけ。helperや製品source、引数、公開JSON、依存、設定を変えない。偽プロセスがPIDを先に保存してから準備を通知し、次の2経路で実際に登録されたlistener・子の停止・manifestを確認する。

| 経路 | 検証するものと限界 |
|---|---|
| 全OSのhandler event | wrapper内のprocess.emit('SIGINT')から実listener、実stopChild、実child close、実manifestへ進む。Windowsのtaskkill経路も使うが、native console Ctrl+Cの配送は検証しない |
| POSIXの実OS signal | 元のprocess.kill(process.pid,'SIGINT')と元の試験名を保持。Windowsではit.skipIfでこのcaseを明示skipし、件数にも出す |

全OS handler caseを追加し、元のnative signal caseはPOSIXで実行、Windowsで明示skipにする。Windowsで従来の実signal入力を実行しないというカバレッジ変更を隠さず、Fの承認範囲として扱う。ほかの既存skip指定は変えない。handler eventはnative Ctrl+Cの配送試験を代替しない。

PID検査はkill(pid,0)とLinux/macOSのzombie判別を使い、不明なエラーを停止済みへ変換しない。正常結果を確認したあと、後片付け前にPIDが生存していないことを追加assertionにする。失敗時のcleanupは、このfixtureが保存した正のPIDを対象候補とし、再照合する。Windowsでは固定PowerShell scriptからCIMのCommandLineを取得し、正規化したfixtureのfake.mjsパスが独立した引数として一致するときだけtaskkill /PID /Fを使う。/Tは使わず、パス・PIDはenvのデータとして渡し、script文字列へ埋め込まない。照合不能・不一致は停止命令を出さず失敗にする。全nodeプロセスや他worktreeを止めない。後片付けの待機上限には既存input.timeoutMs（3000ms）を使い、正常性のassertionをretryで通す方法にはしない。既存rmSyncの指定はそのまま残す。内側のassertionと所有子cleanup、外側withRepoのrmSyncをそれぞれwithCleanupで扱い、単一エラーは同じ例外、多重エラーは入れ子のAggregateError.errorsで全件保持する。cleanup失敗も握り潰さない。

このguardはCIM照合から停止までを原子的に固定するものではなく、その間の競合まで解消したとは主張しない。固定scriptのWindows実行とguardの正常/不一致/取得失敗は新headのCIで確認する。製品helper内の通常のtaskkill経路は今回変更しない。

下は計画commit時点で未適用・未実行の、F承認条件を反映した具体的なpatchである。ignoredの `.loomake/repair-proposal.patch` と同じ差分を示す。適用できることの確認は試験の成功を意味しない。

```diff
diff --git a/tests/delivery-ask-opus.test.ts b/tests/delivery-ask-opus.test.ts
--- a/tests/delivery-ask-opus.test.ts
+++ b/tests/delivery-ask-opus.test.ts
@@ -54,9 +54,83 @@
   });
 });

+async function withCleanup(action: () => void | Promise<void>, cleanup: () => void | Promise<void>) {
+  const errors: unknown[] = [];
+  try { await action(); } catch (error) { errors.push(error); }
+  try { await cleanup(); } catch (error) { errors.push(error); }
+  if (errors.length === 1) throw errors[0];
+  if (errors.length > 1) throw new AggregateError(errors, '試験と後片付けの失敗を保持しました。');
+}
+
+function alive(pid: number): boolean {
+  try { process.kill(pid, 0); }
+  catch (error) {
+    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
+    throw error;
+  }
+  if (process.platform === 'linux') {
+    try { return !/\) Z /.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); }
+    catch (error) {
+      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
+      throw error;
+    }
+  }
+  if (process.platform === 'darwin') {
+    const result = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
+    if (result.error) throw result.error;
+    if (result.status === 1 && !result.stdout.trim()) return false;
+    if (result.status !== 0) throw new Error('子プロセスの状態を確認できませんでした。');
+    return !/^Z/.test(result.stdout.trim());
+  }
+  return true;
+}
+
+function readFakePid(cwd: string): number | undefined {
+  const file = join(cwd, '.loomake/pid');
+  if (!existsSync(file)) return undefined;
+  const pid = Number(readFileSync(file, 'utf8'));
+  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) throw new Error('偽プロセスのPIDが不正です。');
+  return pid;
+}
+
+const windowsStopScript = String.raw`
+$ErrorActionPreference = 'Stop'
+$targetPidValue = [uint32]::Parse($env:LOOMAKE_CLEANUP_PID)
+$expectedFixture = [IO.Path]::GetFullPath($env:LOOMAKE_CLEANUP_FIXTURE)
+$record = Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId = ' + $targetPidValue)
+if ($null -eq $record) { exit 0 }
+if ([string]::IsNullOrWhiteSpace($record.CommandLine)) { throw 'Process command line unavailable' }
+$escapedFixture = [regex]::Escape($expectedFixture)
+$fixtureArgument = '(?:^|\s)(?:"' + $escapedFixture + '"|' + $escapedFixture + ')(?=\s|$)'
+if (-not [regex]::IsMatch($record.CommandLine, $fixtureArgument, [Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
+  throw 'Process fixture argument mismatch'
+}
+& taskkill.exe /PID $targetPidValue /F | Out-Null
+if ($LASTEXITCODE -ne 0) { throw 'Owned process termination failed' }
+`;
+
+async function stopOwnedFake(cwd: string, timeoutMs: number) {
+  const pid = readFakePid(cwd);
+  if (pid === undefined || !alive(pid)) return;
+  if (process.platform === 'win32') {
+    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', windowsStopScript], {
+      env: { ...process.env, LOOMAKE_CLEANUP_PID: String(pid), LOOMAKE_CLEANUP_FIXTURE: join(cwd, '.loomake/fake.mjs') },
+      encoding: 'utf8', shell: false, timeout: timeoutMs, killSignal: 'SIGKILL',
+    });
+    if (result.error) throw result.error;
+    if (result.status !== 0) throw new Error(`所有する偽プロセスを確認・停止できませんでした。${result.stderr}`);
+  } else {
+    try { process.kill(-pid, 'SIGKILL'); }
+    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
+  }
+  const deadline = Date.now() + timeoutMs;
+  while (alive(pid) && Date.now() < deadline) await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
+  if (alive(pid)) throw new Error('所有する偽プロセスが後片付け後も動いています。');
+}
+
 async function withRepo(mode: string, check: (fixture: { cwd: string; input: ReturnType<typeof parseArgs>; options: { cwd: string; executable: string; prefixArgs: string[]; env: NodeJS.ProcessEnv } }) => Promise<void>) {
   const cwd = mkdtempSync(join(tmpdir(), 'loomake-opus-'));
-  try {
+  await withCleanup(async () => {
     execFileSync('git', ['init', '-q'], { cwd });
     writeFileSync(join(cwd, '.gitignore'), '.loomake/\n');
     execFileSync('git', ['add', '.gitignore'], { cwd });
@@ -68,6 +142,7 @@
     const fixture = join(cwd, '.loomake/fake.mjs');
     writeFileSync(fixture, `import {writeFileSync} from 'node:fs';
 const args=process.argv.slice(2); const id=args[args.indexOf('--session-id')+1];
+writeFileSync('.loomake/pid', String(process.pid));
 writeFileSync('.loomake/called', 'yes');
 writeFileSync('.loomake/env.json', JSON.stringify({memory:process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, preserved:process.env.DELIVERY_TEST_SENTINEL}));
 let request=''; for await (const chunk of process.stdin) request+=chunk;
@@ -84,7 +159,7 @@
 `);
     await check({ cwd, input: { role: 'design', request, head, timeoutMs: 3000 },
       options: { cwd, executable: process.execPath, prefixArgs: [fixture], env: { ...process.env, DELIVERY_TEST_MODE: mode, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0', DELIVERY_TEST_SENTINEL: 'kept' } } });
-  } finally { rmSync(cwd, { recursive: true, force: true }); }
+  }, () => rmSync(cwd, { recursive: true, force: true }));
 }

 describe('deliveryのClaude起動', () => {
@@ -214,21 +289,32 @@
       expect(JSON.parse(readFileSync(join(result.dir!, 'manifest.json'), 'utf8')).exitCode).not.toBe(0);
     });
   });
-  it('SIGINTで子プロセスを止め、未実施を保存する', async () => {
+  async function checkInterrupted(trigger: string) {
     await withRepo('timeout', async ({ cwd, input, options }) => {
-      const modulePath = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
-      const code = `import {askOpus} from ${JSON.stringify(pathToFileURL(modulePath).href)};
+      await withCleanup(async () => {
+        const modulePath = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
+        const code = `import {askOpus} from ${JSON.stringify(pathToFileURL(modulePath).href)};
 import {existsSync} from 'node:fs';
-const timer=setInterval(()=>{if(existsSync('.loomake/called')) {clearInterval(timer);process.kill(process.pid,'SIGINT');}},10);
+const timer=setInterval(()=>{if(existsSync('.loomake/called')) {clearInterval(timer);${trigger};}},10);
 console.log(JSON.stringify(await askOpus(${JSON.stringify(input)},${JSON.stringify({ ...options, env: undefined })})));
 clearInterval(timer);`;
-      const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, env: options.env, encoding: 'utf8', timeout: 10000 });
-      expect(child.status).toBe(0);
-      const result = JSON.parse(child.stdout);
-      expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('中断') });
-      expect(JSON.parse(readFileSync(join(result.dir, 'manifest.json'), 'utf8'))).toMatchObject({ ok: false });
-    });
-  });
+        const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
+          cwd, env: options.env, encoding: 'utf8', timeout: 10000, killSignal: 'SIGKILL',
+        });
+        expect(child.error).toBeUndefined();
+        expect(child.signal).toBeNull();
+        expect(child.status, child.stderr).toBe(0);
+        const result = JSON.parse(child.stdout);
+        expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('中断') });
+        expect(JSON.parse(readFileSync(join(result.dir, 'manifest.json'), 'utf8'))).toMatchObject({ ok: false });
+        const pid = readFakePid(cwd);
+        expect(pid).toBeDefined();
+        expect(alive(pid!)).toBe(false);
+      }, () => stopOwnedFake(cwd, input.timeoutMs));
+    });
+  }
+  it('SIGINTイベントで子プロセスを止め、未実施を保存する', () => checkInterrupted("process.emit('SIGINT')"));
+  it.skipIf(process.platform === 'win32')('SIGINTで子プロセスを止め、未実施を保存する', () => checkInterrupted("process.kill(process.pid,'SIGINT')"));

   it('CLIの正常な実行はJSON要約と終了コード0を返す（Windows npm版は未対応）', async () => {
     await withRepo('success', async ({ cwd, input }) => {
```

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

今回、patchの適用も以下の試験も実行していない。実装時は元headと修正head・実行環境・結果を分けて保存する。

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
| 最終レビュー | 規定2回は使用済みで、追加起動は回数の扱いへの別途判断まで保留する。許可後は設計・実装とは別の新Opus sessionで対象head・actual model・結果・拒否・未解決事項を記録する |

過去CIやLinuxの比較だけでWindows修復済みとは報告しない。新しい対象headの必須CI・全OS/shardを確認し、重大な未解決事項があれば規約に従って人へ提示する。

## 証跡の所在と今回の検査

公開資料はこの設計と作業記録に限定し、内部thinking・認証・生envを含めない。管理役が保持するignored資料は `.loomake/investigation/` のCI抜粋・Issue153/116 snapshot・Linux観測、`.loomake/second-opinion/codex-findings.md`、`.loomake/claude/773e82ab-6ea6-46f3-9078-1c31c7628b15/result.md` とsanitized実行情報である。Opusの原文は変更しない。

計画commitの検査は日本語のyomiyasu、diff/applycheck、既存test/helper/configのbyte保持である。次に承認済みpatchを追跡テストへ適用し、型・lint・対象試験・意味のあるmutation/失敗診断回帰・通常verifyを別の実行として記録する。Windows実行は管理役が新headの全OS CIで行い、追加Opusは保留する。文書の検査を製品DoD達成とは扱わない。
