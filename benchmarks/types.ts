import type { ReviewMode } from '../src/config.js';

export type ExpectedFinding = {
  filePath: string;
  line: number;
  keywords: string[];
  priority: 'high' | 'medium' | 'low';
  description: string;
};

export type BenchmarkCase = {
  id: string;
  name: string;
  reviewMode: ReviewMode;
  prTitle: string;
  prBody: string;
  diff: string;
  expectedFindings: ExpectedFinding[];
  maxFalsePositives?: number;
};

export type MatchResult = {
  expected: ExpectedFinding;
  matched: boolean;
  matchedComment?: {
    path: string;
    body: string;
    line: number;
  };
  keywordHits: number;
  lineDelta: number;
  severityCorrect: boolean;
};

export type CaseScore = {
  caseId: string;
  caseName: string;
  recall: number;
  precision: number;
  severityAccuracy: number;
  matchResults: MatchResult[];
  unmatchedComments: number;
  totalExpected: number;
  totalDetected: number;
  durationMs: number;
};

export type BenchmarkReport = {
  timestamp: string;
  model: string;
  cases: CaseScore[];
  aggregate: {
    recall: number;
    precision: number;
    severityAccuracy: number;
  };
};
