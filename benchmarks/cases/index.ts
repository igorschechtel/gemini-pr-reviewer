import type { BenchmarkCase } from '../types.js';
import { cleanCode } from './clean-code.js';
import { mixedIssues } from './mixed-issues.js';
import { nPlusOne } from './n-plus-one.js';
import { nullReference } from './null-reference.js';
import { sqlInjection } from './sql-injection.js';

export const allCases: BenchmarkCase[] = [
  sqlInjection,
  nullReference,
  nPlusOne,
  cleanCode,
  mixedIssues,
];
