// loomake run の設定・記録・実行中の状態の型
import { type Task, type VerifyResult, type VerifyResultV2 } from '@loomake/core';
import { loadConfig } from '@loomake/kit';
import { type RunConfig } from '../config.js';


export type RunOptions = {
  /** プロジェクトのルート（loomake.config.json のあるディレクトリ） */
  root: string;
  changeId: string;
  /** 省くと claude-code */
  engine?: string;
  dryRun?: boolean;
  /** 権限確認なしで動かす。LOOMAKE_SANDBOX=1 のときだけ使える（REQ-121） */
  skipPermissions?: boolean;
  /** 確認を受け付けられるか（標準入力が TTY か） */
  interactive: boolean;
  /** 質問を出し、承諾されたら true を返す */
  confirm: (question: string) => Promise<boolean>;
  stdout: (text: string) => void;
  /** verify の進捗の表示先 */
  progress?: (text: string) => void;
  /** 環境変数。エンジンと git にもそのまま渡す。省くと process.env */
  env?: NodeJS.ProcessEnv;
  /** ファイルがあるか。コンテナの判定に使う。省くと existsSync */
  fileExists?: (path: string) => boolean;
  /** 中断の合図。CLI は SIGINT でこれを送る（REQ-124） */
  signal?: AbortSignal;
  now?: () => Date;
};

/** 止まったときと終えたときに書く記録（REQ-107） */
export type RunSummary = {
  change: string;
  status: 'completed' | 'stopped' | 'interrupted';
  reason: string;
  doneTasks: string[];
  remainingTasks: string[];
  lastVerify: { ok: boolean; mode: string } | null;
};

export const RUNS_DIR = '.loomake/runs';

/** 止まる理由。remaining は残ったタスク */
export type Stop = { status: RunSummary['status']; reason: string; remaining: Task[] };

/** 事前の確認を終えたあとの、run の 1 回分の状態 */
export type RunContext = {
  options: RunOptions;
  root: string;
  changeId: string;
  changeDir: string;
  env: NodeJS.ProcessEnv;
  now: () => Date;
  stdout: (text: string) => void;
  progress: (text: string) => void;
  config: ReturnType<typeof loadConfig>;
  runConfig: RunConfig;
  branch: string;
  startBranch: string;
  hasBranch: boolean;
  tasksPath: string;
  tasksRel: string;
  engineTasks: Task[];
  gateTasks: Task[];
};

/** 実行の記録。止まったときと終えたときに finish で summary.json を書く */
export type Recorder = {
  runDir: string;
  deadline: number;
  done: string[];
  /** 最後の検証結果。いまの書き出しは 1.0.0 で、2.0.0 も読む */
  lastVerify: VerifyResult | VerifyResultV2 | null;
  /** エンジンを呼んだ回数。記録のファイル名の番号に使う */
  step: number;
  save: (name: string, text: string) => void;
  finish: (status: RunSummary['status'], reason: string, remaining: Task[]) => number;
};
