import { describe, expect, test } from 'bun:test';
import {
  computeKeywordScore,
  extractPriority,
  findCandidates,
  scoreCase,
} from '../benchmarks/scorer.ts';
import type { BenchmarkCase, ExpectedFinding } from '../benchmarks/types.ts';
import type { ReviewComment } from '../src/github.ts';

describe('extractPriority', () => {
  test('extracts high priority', () => {
    expect(extractPriority('**🔴 High** — SQL injection risk')).toBe('high');
  });

  test('extracts medium priority', () => {
    expect(extractPriority('**🔶 Medium** — Consider refactoring')).toBe('medium');
  });

  test('extracts low priority', () => {
    expect(extractPriority('**🔷 Low** — Minor style issue')).toBe('low');
  });

  test('returns null for no badge', () => {
    expect(extractPriority('Some comment without a badge')).toBeNull();
  });
});

describe('computeKeywordScore', () => {
  test('counts matching keywords', () => {
    const body = 'This has SQL injection via string interpolation in the query';
    expect(computeKeywordScore(body, ['sql', 'injection', 'interpolation'])).toBe(3);
  });

  test('is case-insensitive', () => {
    expect(computeKeywordScore('SQL Injection found', ['sql', 'injection'])).toBe(2);
  });

  test('returns 0 for no matches', () => {
    expect(computeKeywordScore('Clean code here', ['sql', 'injection'])).toBe(0);
  });
});

describe('findCandidates', () => {
  const expected: ExpectedFinding = {
    filePath: 'src/db.ts',
    line: 10,
    keywords: ['sql', 'injection'],
    priority: 'high',
    description: 'SQL injection',
  };

  test('finds exact line match with keyword', () => {
    const comments: ReviewComment[] = [
      { path: 'src/db.ts', body: '**🔴 High** — SQL injection risk', line: 10, side: 'RIGHT' },
    ];
    expect(findCandidates(expected, comments)).toHaveLength(1);
  });

  test('finds match within tolerance', () => {
    const comments: ReviewComment[] = [
      { path: 'src/db.ts', body: '**🔴 High** — SQL injection risk', line: 13, side: 'RIGHT' },
    ];
    expect(findCandidates(expected, comments)).toHaveLength(1);
  });

  test('rejects match outside tolerance', () => {
    const comments: ReviewComment[] = [
      { path: 'src/db.ts', body: '**🔴 High** — SQL injection risk', line: 20, side: 'RIGHT' },
    ];
    expect(findCandidates(expected, comments)).toHaveLength(0);
  });

  test('rejects wrong file path', () => {
    const comments: ReviewComment[] = [
      {
        path: 'src/other.ts',
        body: '**🔴 High** — SQL injection risk',
        line: 10,
        side: 'RIGHT',
      },
    ];
    expect(findCandidates(expected, comments)).toHaveLength(0);
  });

  test('rejects match without keyword overlap', () => {
    const comments: ReviewComment[] = [
      {
        path: 'src/db.ts',
        body: '**🔴 High** — Consider using constants',
        line: 10,
        side: 'RIGHT',
      },
    ];
    expect(findCandidates(expected, comments)).toHaveLength(0);
  });

  test('handles multi-line comment ranges', () => {
    const comments: ReviewComment[] = [
      {
        path: 'src/db.ts',
        body: '**🔴 High** — SQL injection found',
        line: 14,
        start_line: 8,
        side: 'RIGHT',
        start_side: 'RIGHT',
      },
    ];
    expect(findCandidates(expected, comments)).toHaveLength(1);
  });
});

describe('scoreCase', () => {
  function makeCase(overrides: Partial<BenchmarkCase> = {}): BenchmarkCase {
    return {
      id: 'test',
      name: 'Test Case',
      reviewMode: 'standard',
      prTitle: 'Test PR',
      prBody: 'Test',
      diff: '',
      expectedFindings: [],
      ...overrides,
    };
  }

  test('perfect detection gives 1.0 recall and precision', () => {
    const bc = makeCase({
      expectedFindings: [
        {
          filePath: 'src/db.ts',
          line: 10,
          keywords: ['sql', 'injection'],
          priority: 'high',
          description: 'SQL injection',
        },
      ],
    });

    const comments: ReviewComment[] = [
      { path: 'src/db.ts', body: '**🔴 High** — SQL injection risk', line: 10, side: 'RIGHT' },
    ];

    const score = scoreCase(bc, comments, 1000);
    expect(score.recall).toBe(1);
    expect(score.precision).toBe(1);
    expect(score.severityAccuracy).toBe(1);
    expect(score.totalDetected).toBe(1);
    expect(score.unmatchedComments).toBe(0);
  });

  test('missed finding gives 0 recall', () => {
    const bc = makeCase({
      expectedFindings: [
        {
          filePath: 'src/db.ts',
          line: 10,
          keywords: ['sql', 'injection'],
          priority: 'high',
          description: 'SQL injection',
        },
      ],
    });

    const score = scoreCase(bc, [], 1000);
    expect(score.recall).toBe(0);
    expect(score.totalDetected).toBe(0);
  });

  test('extra comments reduce precision', () => {
    const bc = makeCase({
      expectedFindings: [
        {
          filePath: 'src/db.ts',
          line: 10,
          keywords: ['sql', 'injection'],
          priority: 'high',
          description: 'SQL injection',
        },
      ],
    });

    const comments: ReviewComment[] = [
      { path: 'src/db.ts', body: '**🔴 High** — SQL injection risk', line: 10, side: 'RIGHT' },
      {
        path: 'src/db.ts',
        body: '**🔷 Low** — Consider adding a comment',
        line: 5,
        side: 'RIGHT',
      },
    ];

    const score = scoreCase(bc, comments, 1000);
    expect(score.recall).toBe(1);
    expect(score.precision).toBe(0.5);
    expect(score.unmatchedComments).toBe(1);
  });

  test('wrong severity reduces severity accuracy', () => {
    const bc = makeCase({
      expectedFindings: [
        {
          filePath: 'src/db.ts',
          line: 10,
          keywords: ['sql', 'injection'],
          priority: 'high',
          description: 'SQL injection',
        },
      ],
    });

    const comments: ReviewComment[] = [
      {
        path: 'src/db.ts',
        body: '**🔶 Medium** — SQL injection possible',
        line: 10,
        side: 'RIGHT',
      },
    ];

    const score = scoreCase(bc, comments, 1000);
    expect(score.recall).toBe(1);
    expect(score.severityAccuracy).toBe(0);
  });

  test('greedy matching: each comment matches at most one finding', () => {
    const bc = makeCase({
      expectedFindings: [
        {
          filePath: 'src/db.ts',
          line: 10,
          keywords: ['sql'],
          priority: 'high',
          description: 'First SQL issue',
        },
        {
          filePath: 'src/db.ts',
          line: 15,
          keywords: ['sql'],
          priority: 'high',
          description: 'Second SQL issue',
        },
      ],
    });

    const comments: ReviewComment[] = [
      { path: 'src/db.ts', body: '**🔴 High** — SQL injection risk', line: 10, side: 'RIGHT' },
      {
        path: 'src/db.ts',
        body: '**🔴 High** — SQL query vulnerability',
        line: 15,
        side: 'RIGHT',
      },
    ];

    const score = scoreCase(bc, comments, 1000);
    expect(score.recall).toBe(1);
    expect(score.precision).toBe(1);
    expect(score.totalDetected).toBe(2);
  });

  test('clean code case: no expectations, no comments = perfect score', () => {
    const bc = makeCase({ expectedFindings: [] });
    const score = scoreCase(bc, [], 1000);
    expect(score.recall).toBe(1);
    expect(score.precision).toBe(1);
  });

  test('clean code case: no expectations but false positives reduce precision', () => {
    const bc = makeCase({ expectedFindings: [] });
    const comments: ReviewComment[] = [
      { path: 'src/utils.ts', body: '**🔷 Low** — Unnecessary comment', line: 5, side: 'RIGHT' },
    ];
    const score = scoreCase(bc, comments, 1000);
    expect(score.recall).toBe(1);
    expect(score.precision).toBe(0);
    expect(score.unmatchedComments).toBe(1);
  });

  test('line drift: match within tolerance prefers closest', () => {
    const bc = makeCase({
      expectedFindings: [
        {
          filePath: 'src/db.ts',
          line: 10,
          keywords: ['sql'],
          priority: 'high',
          description: 'SQL issue',
        },
      ],
    });

    const comments: ReviewComment[] = [
      { path: 'src/db.ts', body: '**🔴 High** — SQL risk here', line: 14, side: 'RIGHT' },
      { path: 'src/db.ts', body: '**🔴 High** — SQL problem found', line: 11, side: 'RIGHT' },
    ];

    const score = scoreCase(bc, comments, 1000);
    expect(score.totalDetected).toBe(1);
    // Should match the closer comment (line 11, delta=1) over (line 14, delta=4)
    const matched = score.matchResults.find((r) => r.matched);
    expect(matched?.lineDelta).toBe(1);
  });
});
