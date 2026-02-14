import type { ReviewComment } from '../src/github.js';
import type { BenchmarkCase, CaseScore, ExpectedFinding, MatchResult } from './types.js';

const LINE_TOLERANCE = 5;

export function extractPriority(body: string): 'high' | 'medium' | 'low' | null {
  const match = body.match(/\*\*[🔴🔶🔷]\s*(High|Medium|Low)\*\*/iu);
  if (!match?.[1]) return null;
  return match[1].toLowerCase() as 'high' | 'medium' | 'low';
}

export function computeKeywordScore(body: string, keywords: string[]): number {
  const lower = body.toLowerCase();
  let hits = 0;
  for (const keyword of keywords) {
    if (lower.includes(keyword.toLowerCase())) hits++;
  }
  return hits;
}

export function findCandidates(
  expected: ExpectedFinding,
  comments: ReviewComment[],
  tolerance: number = LINE_TOLERANCE,
): ReviewComment[] {
  return comments.filter((c) => {
    if (c.path !== expected.filePath) return false;

    const startLine = c.start_line ?? c.line;
    const endLine = c.line;

    const withinRange =
      (expected.line >= startLine - tolerance && expected.line <= endLine + tolerance) ||
      (startLine >= expected.line - tolerance && startLine <= expected.line + tolerance);

    if (!withinRange) return false;

    return computeKeywordScore(c.body, expected.keywords) >= 1;
  });
}

export function scoreCase(
  benchmarkCase: BenchmarkCase,
  comments: ReviewComment[],
  durationMs: number,
): CaseScore {
  const consumed = new Set<number>();
  const matchResults: MatchResult[] = [];

  for (const expected of benchmarkCase.expectedFindings) {
    const candidates = findCandidates(expected, comments);

    // Filter out already-consumed comments and rank by keyword score, then line proximity
    const ranked = candidates
      .map((c) => {
        const idx = comments.indexOf(c);
        return {
          comment: c,
          idx,
          keywordHits: computeKeywordScore(c.body, expected.keywords),
          lineDelta: Math.abs(c.line - expected.line),
        };
      })
      .filter((r) => !consumed.has(r.idx))
      .sort((a, b) => b.keywordHits - a.keywordHits || a.lineDelta - b.lineDelta);

    const best = ranked[0];
    if (best) {
      consumed.add(best.idx);
      const detectedPriority = extractPriority(best.comment.body);
      matchResults.push({
        expected,
        matched: true,
        matchedComment: {
          path: best.comment.path,
          body: best.comment.body,
          line: best.comment.line,
        },
        keywordHits: best.keywordHits,
        lineDelta: best.lineDelta,
        severityCorrect: detectedPriority === expected.priority,
      });
    } else {
      matchResults.push({
        expected,
        matched: false,
        keywordHits: 0,
        lineDelta: 0,
        severityCorrect: false,
      });
    }
  }

  const totalExpected = benchmarkCase.expectedFindings.length;
  const totalDetected = matchResults.filter((r) => r.matched).length;
  const unmatchedComments = comments.length - consumed.size;

  const recall = totalExpected > 0 ? totalDetected / totalExpected : 1;
  const precision =
    totalDetected + unmatchedComments > 0 ? totalDetected / (totalDetected + unmatchedComments) : 1;

  const severityMatches = matchResults.filter((r) => r.matched && r.severityCorrect).length;
  const severityAccuracy = totalDetected > 0 ? severityMatches / totalDetected : 1;

  return {
    caseId: benchmarkCase.id,
    caseName: benchmarkCase.name,
    recall,
    precision,
    severityAccuracy,
    matchResults,
    unmatchedComments,
    totalExpected,
    totalDetected,
    durationMs,
  };
}
