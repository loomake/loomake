/** 観測済みの値だけを使う、実行固有の判断。I/Oは呼び出し側が担当する。 */
export type EngineObservation = Readonly<{
  aborted: boolean;
  outputLimitExceeded?: boolean;
  timedOut: boolean;
  text: string;
  exitCode: number | null;
  movementReason?: string;
  internalsReason?: string;
}>;
export type EngineDecision = { kind: 'continue' } | { kind: 'stop'; status: 'stopped' | 'interrupted'; reason: string };
export type GateObservation = Readonly<{ stateChanged: boolean; ok: boolean; interrupted?: boolean; timedOut: boolean; fixes: number; maxFixes: number }>;
export type GateDecision = { kind: 'passed' | 'repair' } | { kind: 'stop' | 'interrupted'; reason: string };

/** 変更の理由を先に示し、中断の状態は保持する（REQ-204）。 */
export function decideAfterEngine(value: EngineObservation): EngineDecision {
  let stop: Extract<EngineDecision, { kind: 'stop' }> | undefined;
  if (value.aborted) stop = { kind: 'stop', status: 'interrupted', reason: '中断されました' };
  else if (value.outputLimitExceeded) stop = { kind: 'stop', status: 'stopped', reason: 'エンジンの出力が上限に達しました' };
  else if (value.timedOut) stop = { kind: 'stop', status: 'stopped', reason: '実行時間の上限に達しました' };
  else {
    const question = value.text.match(/^LOOMAKE-QUESTION:\s*(.*)$/m);
    if (question) stop = { kind: 'stop', status: 'stopped', reason: `エンジンが質問しました：${question[1]}` };
    else if (value.exitCode !== 0) stop = { kind: 'stop', status: 'stopped', reason: `エンジンが終了コード ${value.exitCode ?? '（なし）'} で終わりました` };
  }
  const changed = value.movementReason ?? value.internalsReason;
  if (changed) return { kind: 'stop', status: stop?.status ?? 'stopped', reason: stop ? `${changed}。${stop.reason}` : changed };
  return stop ?? { kind: 'continue' };
}

/** 検証中の変更、合格、期限、修正回数の順に判断する（REQ-205）。 */
export function decideAfterGate(value: GateObservation): GateDecision {
  if (value.stateChanged) return { kind: 'stop', reason: '検証のあいだにHEADかブランチが変わりました。変更を取り消していません。Gitの状態を確認してから、もう一度実行してください。' };
  if (value.ok) return { kind: 'passed' };
  if (value.interrupted) return { kind: 'interrupted', reason: '中断されました' };
  if (value.timedOut) return { kind: 'stop', reason: '実行時間の上限に達しました' };
  if (value.fixes >= value.maxFixes) return { kind: 'stop', reason: `直しの回数の上限（${value.maxFixes} 回）に達しました` };
  return { kind: 'repair' };
}

export type ChangeObservation = Readonly<{ phase: 'task' | 'repair'; hasChanges: boolean; text: string }>;
export type ChangeDecision = { kind: 'commit' | 'stop' } | { kind: 'no-change'; reason: string };

/** エンジンの変更がない場合の完了と停止を判断する（REQ-332）。 */
export function decideAfterChanges(value: ChangeObservation): ChangeDecision {
  if (value.hasChanges) return { kind: 'commit' };
  if (value.phase === 'repair') return { kind: 'stop' };
  const signal = value.text.match(/^LOOMAKE-NOCHANGE:[ \t]*(\S.*)$/m);
  return signal ? { kind: 'no-change', reason: signal[1] } : { kind: 'stop' };
}
