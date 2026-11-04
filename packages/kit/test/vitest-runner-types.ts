import { TestRunner, type RunnerTestCase, type TestContext } from 'vitest';
import { defineConfig } from 'vitest/config';
import { createBodyRunner } from '@loomake/kit';

// Consumer setup: runner.ts exports this class; vitest.config.ts selects its path.
export const ExampleRunner = createBodyRunner(TestRunner);
export const exampleConfig = defineConfig({ test: { runner: './runner.ts' } });

export function typecheckBodyRunner(config: ConstructorParameters<typeof TestRunner>[0]): void {
  const runner: TestRunner = new ExampleRunner(config);
  const accessor: typeof TestRunner.getTestFn = ExampleRunner.getTestFn;
  // @ts-expect-error public constructor configuration is still required
  new ExampleRunner();
  // @ts-expect-error the original SerializedConfig type is retained
  new ExampleRunner('invalid');
  class ExistingRunner extends TestRunner {
    constructor(settings: ConstructorParameters<typeof TestRunner>[0], readonly extra: string) { super(settings); }
    runTask = async (task: RunnerTestCase): Promise<void> => { await TestRunner.getTestFn(task)?.(); };
    override extendTaskContext = (context: TestContext): TestContext => context;
    literal = 'preserved' as const;
  }
  const Composed = createBodyRunner(ExistingRunner);
  const custom: ExistingRunner = new Composed(config, 'extra');
  const literal: 'preserved' = custom.literal;
  // @ts-expect-error the custom constructor's second argument remains required
  new Composed(config);
  // @ts-expect-error readonly instance members retain their original constraint
  custom.extra = 'changed';
  void runner; void accessor; void custom; void literal;
}
