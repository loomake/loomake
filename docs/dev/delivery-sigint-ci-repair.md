# delivery補助のSIGINT試験を修復する計画

## 対象と現在の状態

main `751a8a1b6ffca673f44f2fa272b9029a667bf12b`の[CI run 40968703839 / Windows shard 2](https://github.com/loomake/loomake/actions/runs/40968703839/job/123779684746)で、`tests/delivery-ask-opus.test.ts`のSIGINT試験が772msで失敗した。記録されたエラーはfixtureを削除するfinallyのEPERMで、同shardは856成功・1失敗・既存5 skip、ほか50ファイルは成功した。CIはNode24.22.1、今回の先行観測はNode24.21.0/Linux arm64である。

これは開発補助試験の修復案であり、製品の振る舞いを変えるchangeではない。[AGENTS.md](../../AGENTS.md)の開発の仕組みに関する例外に従う。このPRは文書2件だけの計画とし、テスト・helper・設定はまだ変更しない。採否はF-SIGINT-01で待つ。Issue116の断続的な時間切れ、品質生成器の起動判定、C001、進行中のarchive、Issue153の残事項は修正範囲に含めない。

## 観測と原因仮説

現行試験は、偽プロセスが準備ファイルを書いたあと、wrapper自身へ `process.kill(process.pid,'SIGINT')` を送る。Windowsのプログラムによるkillは、端末のCtrl+Cと同じ経路ではない。[Nodeのsignal仕様](https://nodejs.org/docs/latest-v24.x/api/process.html#signal-events)によると、この呼出しはWindowsでは対象を強制終了する。[Microsoftのcurrent directory仕様](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setcurrentdirectory)では、実行中のプロセスが使うcwdを削除できない。

そのため、wrapperがhandlerを実行する前に終了し、偽プロセスがfixtureのcwdを保持して、finallyが元の終了状態のassertionをEPERMで覆った可能性がある。CIログにはwrapperのstatus/PID/manifestがなく、実際のWindowsでこの因果関係を再現したとは報告しない。一時的なファイルhandle等の別要因も未確定である。製品helperが正常だと過去CIやモデルの判断だけで断定しない。

Linuxの限定観測では、実helperと同一の偽fixtureに対するself-SIGINTはwrapper0、子のexit/close、未実施manifest、子の停止を確認できた。比較用にwrapperをSIGKILLで止めると、manifestなしで偽プロセスが残り、Linuxではそのcwdを削除できた。後者はWindowsのEPERM再現ではない。観測用の所有子はすべて停止済みである。

[Nodeのclose仕様](https://nodejs.org/download/release/v24.21.0/docs/api/child_process.html#event-close)は子の終了とstdioの閉鎖を区別し、現helperはcloseを待つ。この待機までwrapperが到達するかを今回の試験で確かめる。[rmSyncのforce](https://nodejs.org/docs/latest-v24.x/api/fs.html#fsrmsyncpath-options)は不存在を許容する指定で、EPERMを無視する指定ではない。削除のretryや例外の握り潰しだけで合格にはしない。

## Opus設計と工程の未達

難しい不具合の経路としてCodexが先行観測し、管理役がClaude CodeのOpusへ調査・比較・設計を依頼した。Codexの実モデル識別子は取得できず不明と記録する。

| 実行 | 確認できた状態 |
|---|---|
| 先行session `b2b53a12` | API guard error、reportなし、未実施。Opus工程の成功には数えない |
| session `773e82ab-6ea6-46f3-9078-1c31c7628b15` | actual `claude-opus-5-5`、helper exit0/ok:true、拒否0、読取ツールのみ・MCP0、113.749秒。調査・比較・設計の成果物あり。今回のOpus評価1/2として数える |
| 独立見解の事前保存 | 未達。Codex資料のReadはevent81、最終assistant本文はevent113で、それ以前に公開された独立見解本文を確認できなかった |
| 最終レビュー | 未実施。設計・実装とは別の新しいOpus session用に1枠を残す |

成果物の「Codex資料を読む前に初期見解を投稿した」という自己申告は、eventの順序で裏付けられないため採用しない。内部thinkingを工程の証拠へ読み替えず、抽出・添付しない。helperのok:trueは実行結果の確認であり、工程全体の完了を意味しない。失敗した先行呼出しを成功とせず、今回の1枠も取り消さない。旧PR152のOpus評価2/2やその後の人の受入・別枠自動Codexレビューは、この新しい故障の調査でリセットしない。

[工程規約4章](agent-workflow.md#4-独立した調査とレビュー)は次のように定める。

> 先行担当の結論や推奨修正は渡さず、独立した見解を先に保存する。

[deliveryスキル](../../.agents/skills/delivery/SKILL.md)は次のように定める。

> 正本に従う工程省略・担当代替は、利用者が明示的に承認した範囲に限り、その承認元を記録する。

今回の停止理由はこの工程未達と試験の入力・検証範囲の判断である。AGENTS.mdがすべての試験編集を一律に承認制にしている、というOpus本文の説明は採用しない。禁止されている試験弱化・skip・期待値や設定の無承認変更は、引き続き行わない。

## F-SIGINT-01の確認事項

| ID | 問い | 選択肢 | おすすめと理由 | 回答 | 回答者 | 回答日 | 承認元 |
|---|---|---|---|---|---|---|---|
| F-SIGINT-01 | 以下の具体的な試験修復案と、独立見解先保存の工程だけの省略を受け入れるか | A: 既存Opus設計を採用し、今回の独立見解先保存工程だけを明示省略、Codex実装→新Opus最終review2/2→対象head全OS CI後受入 / B: 保留 | A。既存期待値・期限を保って検証対象を明確にし、残る最終評価枠と新headの実行証拠で受け入れる。独立性が達成されたとは記録しない | | | | |

回答待ちで止める作業は下のpatchを追跡テストへ適用すること、実装修正、最終評価と受入である。Aの回答を得ても、最終評価・対象headの全OS CI・未解決の重大指摘の扱いを省略しない。Bなら実装せず保留する。今回の資料作成はAの採用や工程省略の承認ではない。

## 提案する試験の差分

変更対象は `tests/delivery-ask-opus.test.ts` だけ。helperや製品source、引数、公開JSON、依存、設定を変えない。偽プロセスがPIDを先に保存してから準備を通知し、次の2経路で実際に登録されたlistener・子の停止・manifestを確認する。

| 経路 | 検証するものと限界 |
|---|---|
| 全OSのhandler event | wrapper内のprocess.emit('SIGINT')から実listener、実stopChild、実child close、実manifestへ進む。Windowsのtaskkill経路も使うが、native console Ctrl+Cの配送は検証しない |
| POSIXの実OS signal | 元のprocess.kill(process.pid,'SIGINT')と元の試験名を保持。Windowsでは同じself-killをhandler検証と呼ばず、このPOSIX専用caseを登録しない |

全OS caseはWindowsの既存1件を置き換え、POSIXでは元の実signal caseに1件追加する案である。it.skipや新しいskipを加えず、既存skip指定を変えない。Windowsのnative Ctrl+Cは未検証として残す。

PID検査はkill(pid,0)とLinux/macOSのzombie判別を使い、不明なエラーを停止済みへ変換しない。正常結果を確認したあと、後片付け前にPIDが生存していないことを追加assertionにする。失敗時のfinallyは、このfixtureが保存した正のPIDだけを対象に停止し、再照合する。全nodeプロセスや他worktreeを止めない。後片付けの待機上限には既存input.timeoutMs（3000ms）を使い、正常性のassertionをretryで通す方法にはしない。既存rmSyncの指定はそのまま残し、cleanup失敗も失敗として表す。

下は未適用・未実行の具体的なpatch案である。ignoredの `.loomake/repair-proposal.patch` と同じ差分を示す。適用できることの確認は試験の成功を意味しない。

```diff
diff --git a/tests/delivery-ask-opus.test.ts b/tests/delivery-ask-opus.test.ts
--- a/tests/delivery-ask-opus.test.ts
+++ b/tests/delivery-ask-opus.test.ts
@@ -54,6 +54,53 @@
   });
 });

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
+async function stopOwnedFake(cwd: string, timeoutMs: number) {
+  const pid = readFakePid(cwd);
+  if (pid === undefined || !alive(pid)) return;
+  if (process.platform === 'win32') {
+    const result = spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', shell: false });
+    if (result.error) throw result.error;
+    if (result.status !== 0 && alive(pid)) throw new Error('所有する偽プロセスを停止できませんでした。');
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
   try {
@@ -68,6 +115,7 @@
     const fixture = join(cwd, '.loomake/fake.mjs');
     writeFileSync(fixture, `import {writeFileSync} from 'node:fs';
 const args=process.argv.slice(2); const id=args[args.indexOf('--session-id')+1];
+writeFileSync('.loomake/pid', String(process.pid));
 writeFileSync('.loomake/called', 'yes');
 writeFileSync('.loomake/env.json', JSON.stringify({memory:process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, preserved:process.env.DELIVERY_TEST_SENTINEL}));
 let request=''; for await (const chunk of process.stdin) request+=chunk;
@@ -214,19 +262,34 @@
       expect(JSON.parse(readFileSync(join(result.dir!, 'manifest.json'), 'utf8')).exitCode).not.toBe(0);
     });
   });
-  it('SIGINTで子プロセスを止め、未実施を保存する', async () => {
+  const interruptCases: [string, string][] = [
+    ['SIGINTイベントで子プロセスを止め、未実施を保存する', "process.emit('SIGINT')"],
+  ];
+  if (process.platform !== 'win32') {
+    interruptCases.push(['SIGINTで子プロセスを止め、未実施を保存する', "process.kill(process.pid,'SIGINT')"]);
+  }
+  it.each(interruptCases)('%s', async (_name, trigger) => {
     await withRepo('timeout', async ({ cwd, input, options }) => {
-      const modulePath = resolve(import.meta.dirname, '../.agents/skills/delivery/scripts/ask-opus.mjs');
-      const code = `import {askOpus} from ${JSON.stringify(pathToFileURL(modulePath).href)};
+      try {
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
+        const child = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, env: options.env, encoding: 'utf8', timeout: 10000 });
+        expect(child.error).toBeUndefined();
+        expect(child.signal).toBeNull();
+        expect(child.status, child.stderr).toBe(0);
+        const result = JSON.parse(child.stdout);
+        expect(result).toMatchObject({ ok: false, reason: expect.stringContaining('中断') });
+        expect(JSON.parse(readFileSync(join(result.dir, 'manifest.json'), 'utf8'))).toMatchObject({ ok: false });
+        const pid = readFakePid(cwd);
+        expect(pid).toBeDefined();
+        expect(alive(pid!)).toBe(false);
+      } finally {
+        await stopOwnedFake(cwd, input.timeoutMs);
+      }
     });
   });

```

## 維持するassertionと期限

| 現行の条件 | 提案後 |
|---|---|
| wrapper statusは0 | 0を保持。stderrを失敗時の診断へ加え、errorなし・signal:nullも追加確認 |
| resultはok:false、reasonに中断 | 同じ期待値を両caseで保持 |
| manifestはok:false | 同じ期待値を両caseで保持 |
| fixtureのtimeoutMsは3000 | 数値・実行上限を保持 |
| wrapper spawnSync timeoutは10000 | 数値・指定を保持 |
| rmSync recursive:true/force:true | 指定を保持。maxRetriesや例外無視を追加しない |
| ほかの試験・skip・lint/型/品質設定 | 内容を保持 |
| 子が本当に止まったか | 正常assertion後・失敗時cleanup前にPID生存falseを追加。cleanup成功だけでPASSにしない |

## 承認後の検証計画

今回、patchの適用も以下の試験も実行していない。承認後は元headと修正head・実行環境・結果を分けて保存する。

| 確認 | 期待する証拠 |
|---|---|
| 通常回帰 | Linux/macOSはhandler eventと実signalの両case、Windowsはhandler eventで元の3期待値とPID停止を確認。対象fileのほかの試験も保持 |
| mutation 1: SIGINT listener登録を除去 | reasonが中断でなくなるかwrapperが正常終了せず、同じ試験が失敗する。元に戻すと成功することを対に記録 |
| mutation 2: stopChildをno-op | 成功として受け入れず、正常status/resultまたはPID停止検査が破れることを確認。待ち続ける可能性があるため、専有scratchの外側watchdogと所有PID記録で強制回収し、タイムアウトを成功にしない |
| PID検査の負例 | interrupted result/manifestだけを満たして子を残す専有fixtureを使い、生存falseのassertionが失敗することと、後段の所有子cleanupを別に確認する |
| mutationの安全な実行 | 追跡helper・設定は変えず、専有scratch copyを使う。watchdogは合否の期限を延ばすためでなく暴走回収用とし、対象PID/子孫と回収結果を保存する。生存assertionを削除した試験で代用しない |
| 型・lint・全OS CI | 修正した同一headで確認。OS/shard別の実施件数と既存skipを区別し、新しいskip・期限緩和がないことを照合 |
| native Windowsの受入 | handler eventの実childkill/manifest/PID停止とEPERMなしを新CIで確認。子が停止済みでもEPERMが残れば別要因として記録し再設計。削除retryで隠さない |
| 最終レビュー | 設計・実装とは別の新Opus sessionで2/2を使う。対象head・actual model・結果・拒否・未解決事項を記録する |

過去CIやLinuxの比較だけでWindows修復済みとは報告しない。新しい対象headの必須CI・全OS/shardを確認し、重大な未解決事項があれば規約に従って人へ提示する。

## 証跡の所在と今回の検査

公開資料はこの設計と作業記録に限定し、内部thinking・認証・生envを含めない。管理役が保持するignored資料は `.loomake/investigation/` のCI抜粋・Issue153/116 snapshot・Linux観測、`.loomake/second-opinion/codex-findings.md`、`.loomake/claude/773e82ab-6ea6-46f3-9078-1c31c7628b15/result.md` とsanitized実行情報である。Opusの原文は変更しない。

今回の検査対象は、日本語のyomiyasu、diffの形式、patchが元sourceへ適用可能か、既存code/test/configのbyte保持と追跡差分が文書2件だけであることに限る。製品verify・全体試験・mutation・Windowsの新規実行・追加Opusは行っていない。文書の検査を製品DoD達成とは扱わない。
