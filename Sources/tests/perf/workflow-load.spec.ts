/**
 * @file workflow-load.spec.ts
 * @brief Automated performance benchmark for the workflow editor.
 * @author Silvia Šlachtovská
 *
 * This Playwright test measures the latency of key editor operations
 * under increasing workload (number of nodes in the graph).
 *
 */
import { test, expect, Page } from '@playwright/test';
import { simpleTaskPreset } from './simpleTaskPreset';
import fs from 'node:fs';
import path from 'node:path';

const RUNS = 5;

type BenchmarkResult = {
  inserted: number;
  totalNodes: number;
  insertMs: number;
  deleteMs: number;
  undoMs: number;
};

async function measureAfterTwoFrames<T>(
  page: Page,
  action: () => Promise<T> | T
): Promise<{ durationMs: number; result: T }> {
  const start = await page.evaluate(() => performance.now());
  const result = await action();

  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      })
  );

  const end = await page.evaluate(() => performance.now());

  return {
    durationMs: end - start,
    result,
  };
}

test('workflow benchmark: insert, delete, undo', async ({ page }) => {
  const results: BenchmarkResult[] = [];

  await page.goto('/');

  await page.waitForFunction(() => !!window.__workflowTestApi);

  const sizes = [10, 20, 50, 100, 185, 250, 500, 750, 1000];

for (const size of sizes) {
  const insertTimes: number[] = [];
  const deleteTimes: number[] = [];
  const undoTimes: number[] = [];

  for (let run = 0; run < RUNS; run++) {
    await page.evaluate(() => {
      window.__workflowTestApi?.resetWorkflow();
    });

    // INSERT
    const insert = await measureAfterTwoFrames(page, () =>
      page.evaluate(
        ({ preset, count }) =>
          window.__workflowTestApi?.insertPresetCopies(preset as never, count),
        { preset: simpleTaskPreset, count: size }
      )
    );

    insertTimes.push(insert.durationMs);

    const totalNodes = await page.evaluate(
      () => window.__workflowTestApi?.getNodeCount() ?? 0
    );

    expect(totalNodes).toBe(size);

    // SELECT
    await page.evaluate(() => {
      window.__workflowTestApi?.selectFirstNode();
    });

    // DELETE
    const del = await measureAfterTwoFrames(page, () =>
      page.evaluate(() => window.__workflowTestApi?.deleteSelection())
    );

    deleteTimes.push(del.durationMs);

    // UNDO
    const undo = await measureAfterTwoFrames(page, () =>
      page.evaluate(() => window.__workflowTestApi?.undo())
    );

    undoTimes.push(undo.durationMs);
  }

  const avg = (arr: number[]) =>
    arr.reduce((a, b) => a + b, 0) / arr.length;

  results.push({
    inserted: size,
    totalNodes: size,
    insertMs: Number(avg(insertTimes).toFixed(2)),
    deleteMs: Number(avg(deleteTimes).toFixed(2)),
    undoMs: Number(avg(undoTimes).toFixed(2)),
  });
}

  const outDir = path.resolve(process.cwd(), 'tests', 'perf', 'results');
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(
    path.join(outDir, 'workflow-benchmark.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log('Benchmark results:', results);
});