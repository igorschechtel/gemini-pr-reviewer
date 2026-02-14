import { parseArgs } from 'node:util';
import type { ReviewComment } from '../src/github.js';
import { run } from '../src/index.js';
import { allCases } from './cases/index.js';
import { buildBenchmarkConfig, buildBenchmarkDeps } from './helpers.js';
import { printCaseDetails, printConsoleReport, writeJsonReport } from './reporter.js';
import { scoreCase } from './scorer.js';
import type { BenchmarkReport, CaseScore } from './types.js';

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    case: { type: 'string', short: 'c' },
    model: { type: 'string', short: 'm' },
  },
  strict: false,
});

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY is required');
  process.exit(1);
}

const caseFilter = values.case as string | undefined;
const modelOverride = values.model as string | undefined;
const model = modelOverride || 'gemini-2.0-flash';

const casesToRun = caseFilter ? allCases.filter((c) => c.id === caseFilter) : allCases;

if (casesToRun.length === 0) {
  console.error(`No case found with id "${caseFilter}"`);
  console.error(`Available cases: ${allCases.map((c) => c.id).join(', ')}`);
  process.exit(1);
}

console.log(`Running ${casesToRun.length} benchmark case(s) with model: ${model}`);
console.log('');

const scores: CaseScore[] = [];

for (const benchmarkCase of casesToRun) {
  console.log(`--- ${benchmarkCase.name} (${benchmarkCase.id}) ---`);

  const capturedComments: ReviewComment[] = [];
  const config = buildBenchmarkConfig(benchmarkCase, apiKey, model);
  const deps = buildBenchmarkDeps(benchmarkCase, capturedComments, model);

  const env: Record<string, string> = {
    GITHUB_EVENT_PATH: '/tmp/benchmark-event.json',
    GITHUB_EVENT_NAME: 'issue_comment',
    GEMINI_API_KEY: apiKey,
  };

  const start = performance.now();
  try {
    await run({ config, env, deps });
  } catch (error) {
    console.error(`  Error running case: ${(error as Error).message}`);
  }
  const durationMs = performance.now() - start;

  const score = scoreCase(benchmarkCase, capturedComments, durationMs);
  scores.push(score);

  console.log(
    `  Recall: ${(score.recall * 100).toFixed(0)}% | Precision: ${(score.precision * 100).toFixed(0)}% | Found: ${score.totalDetected}/${score.totalExpected} | Extra: ${score.unmatchedComments} | ${(durationMs / 1000).toFixed(1)}s`,
  );
  console.log('');
}

const totalExpected = scores.reduce((sum, s) => sum + s.totalExpected, 0);
const totalDetected = scores.reduce((sum, s) => sum + s.totalDetected, 0);
const totalUnmatched = scores.reduce((sum, s) => sum + s.unmatchedComments, 0);
const totalSeverityCorrect = scores.reduce(
  (sum, s) => sum + s.matchResults.filter((r) => r.matched && r.severityCorrect).length,
  0,
);

const report: BenchmarkReport = {
  timestamp: new Date().toISOString(),
  model,
  cases: scores,
  aggregate: {
    recall: totalExpected > 0 ? totalDetected / totalExpected : 1,
    precision:
      totalDetected + totalUnmatched > 0 ? totalDetected / (totalDetected + totalUnmatched) : 1,
    severityAccuracy: totalDetected > 0 ? totalSeverityCorrect / totalDetected : 1,
  },
};

printConsoleReport(report);
printCaseDetails(scores);

const reportPath = await writeJsonReport(report);
console.log(`JSON report written to: ${reportPath}`);
