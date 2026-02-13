import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BenchmarkReport, CaseScore } from './types.js';

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function padLeft(str: string, len: number): string {
  return str.padStart(len);
}

export function printConsoleReport(report: BenchmarkReport): void {
  const header = [
    pad('Case', 35),
    padLeft('Recall', 8),
    padLeft('Prec.', 8),
    padLeft('Sev.', 8),
    padLeft('Found', 7),
    padLeft('Expect', 8),
    padLeft('Extra', 7),
    padLeft('Time', 8),
  ].join(' ');

  console.log('');
  console.log(`Benchmark Report — ${report.model}`);
  console.log('='.repeat(header.length));
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const c of report.cases) {
    const row = [
      pad(c.caseName.slice(0, 34), 35),
      padLeft(pct(c.recall), 8),
      padLeft(pct(c.precision), 8),
      padLeft(pct(c.severityAccuracy), 8),
      padLeft(String(c.totalDetected), 7),
      padLeft(String(c.totalExpected), 8),
      padLeft(String(c.unmatchedComments), 7),
      padLeft(`${(c.durationMs / 1000).toFixed(1)}s`, 8),
    ].join(' ');
    console.log(row);
  }

  console.log('-'.repeat(header.length));

  const aggRow = [
    pad('AGGREGATE', 35),
    padLeft(pct(report.aggregate.recall), 8),
    padLeft(pct(report.aggregate.precision), 8),
    padLeft(pct(report.aggregate.severityAccuracy), 8),
    padLeft('', 7),
    padLeft('', 8),
    padLeft('', 7),
    padLeft('', 8),
  ].join(' ');
  console.log(aggRow);
  console.log('');
}

export function printCaseDetails(scores: CaseScore[]): void {
  for (const score of scores) {
    const missed = score.matchResults.filter((r) => !r.matched);
    if (missed.length === 0) continue;

    console.log(`  Missed in "${score.caseName}":`);
    for (const m of missed) {
      console.log(`    - ${m.expected.description} (line ${m.expected.line})`);
    }
  }
}

export async function writeJsonReport(report: BenchmarkReport): Promise<string> {
  const reportsDir = join(import.meta.dir, 'reports');
  await mkdir(reportsDir, { recursive: true });

  const timestamp = report.timestamp.replace(/[:.]/g, '-');
  const filePath = join(reportsDir, `${timestamp}.json`);
  await writeFile(filePath, JSON.stringify(report, null, 2));
  return filePath;
}
