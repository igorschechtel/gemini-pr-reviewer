import { minimatch } from 'minimatch';
import parseDiff from 'parse-diff';

export type DiffLine = {
  content: string;
  type: 'add' | 'del' | 'normal';
  oldNumber?: number;
  newNumber?: number;
};

export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export type DiffFile = {
  path: string;
  hunks: DiffHunk[];
};

export type LineMeta = {
  position: number;
  diffPosition: number;
  reviewable: boolean;
  hunkIndex: number;
  content: string;
};

export type NumberedPatch = {
  lines: string[];
  lineMeta: Map<number, LineMeta>;
  hunkPositions: Map<number, number[]>;
};

export type DiffParseOptions = {
  includePatterns: string[];
  excludePatterns: string[];
  maxFiles: number;
  maxHunksPerFile: number;
  maxLinesPerHunk: number;
};

export function parseUnifiedDiff(diffText: string): DiffFile[] {
  if (!diffText) return [];

  const files = parseDiff(diffText);
  const results: DiffFile[] = [];

  for (const file of files) {
    const rawPath: string | undefined = file.to || file.from;
    if (!rawPath) continue;
    const path = rawPath.replace(/^b\//, '').replace(/^a\//, '');

    const hunks: DiffHunk[] = [];
    const chunks = file.chunks || [];

    for (const chunk of chunks) {
      const header = (chunk.content || '').trimEnd();
      const changes = chunk.changes || [];
      const lines: DiffLine[] = changes.map((change) => {
        const c = change as { ln1?: number; ln2?: number; ln?: number };
        return {
          content: change.content,
          type: change.type,
          oldNumber: c.ln1 ?? (change.type === 'del' ? c.ln : undefined),
          newNumber: c.ln2 ?? (change.type === 'add' ? c.ln : undefined),
        };
      });

      if (lines.length > 0) {
        hunks.push({ header, lines });
      }
    }

    if (hunks.length > 0) {
      results.push({ path, hunks });
    }
  }

  return results;
}

export function filterDiffFiles(files: DiffFile[], options: DiffParseOptions): DiffFile[] {
  const filtered: DiffFile[] = [];

  for (const file of files) {
    if (options.includePatterns.length > 0) {
      const matchesInclude = options.includePatterns.some((pattern) =>
        minimatch(file.path, pattern, { matchBase: true, dot: true }),
      );
      if (!matchesInclude) continue;
    }

    if (options.excludePatterns.length > 0) {
      const matchesExclude = options.excludePatterns.some((pattern) =>
        minimatch(file.path, pattern, { matchBase: true, dot: true }),
      );
      if (matchesExclude) continue;
    }

    filtered.push(file);
    if (filtered.length >= options.maxFiles) break;
  }

  return filtered;
}

export function buildNumberedPatch(file: DiffFile, options: DiffParseOptions): NumberedPatch {
  const lines: string[] = [];
  const lineMeta = new Map<number, LineMeta>();
  const hunkPositions = new Map<number, number[]>();

  let diffPosition = 0;
  let position = 0;

  const hunks = file.hunks.slice(0, options.maxHunksPerFile);

  hunks.forEach((hunk, hunkIndex) => {
    // Header line counts as a position in the diff
    diffPosition += 1;

    // We only display the header if we are within limits (handled logic below),
    // but we need to track it for diffPosition correctness.
    const headerPosition = position + 1;
    position += 1;
    lines.push(`${headerPosition} | ${hunk.header}`);

    lineMeta.set(headerPosition, {
      position: headerPosition,
      diffPosition,
      reviewable: false,
      hunkIndex,
      content: hunk.header,
    });
    hunkPositions.set(hunkIndex, [headerPosition]);

    const limitedLinesCount = options.maxLinesPerHunk;

    hunk.lines.forEach((line, index) => {
      diffPosition += 1;

      // Only include in the prompt if within limits
      if (index < limitedLinesCount) {
        position += 1;
        lines.push(`${position} | ${line.content}`);

        const reviewable =
          (line.type === 'add' || line.type === 'normal') &&
          !line.content.startsWith('\\ No newline');

        lineMeta.set(position, {
          position,
          diffPosition,
          reviewable,
          hunkIndex,
          content: line.content,
        });

        const positions = hunkPositions.get(hunkIndex) || [];
        positions.push(position);
        hunkPositions.set(hunkIndex, positions);
      }
    });
  });

  return { lines, lineMeta, hunkPositions };
}

export function buildGlobalDiff(
  files: DiffFile[],
  options: DiffParseOptions,
  maxLines: number,
): string {
  if (maxLines <= 0) return '';

  const lines: string[] = [];
  const pushLine = (line: string): boolean => {
    if (lines.length >= maxLines) return false;
    lines.push(line);
    return true;
  };

  for (const file of files) {
    if (!pushLine(`File: ${file.path}`)) break;

    const hunks = file.hunks.slice(0, options.maxHunksPerFile);
    for (const hunk of hunks) {
      if (!pushLine(hunk.header)) return lines.join('\n');

      const limitedLines = hunk.lines.slice(0, options.maxLinesPerHunk);
      for (const line of limitedLines) {
        if (!pushLine(line.content)) return lines.join('\n');
      }
    }
  }

  return lines.join('\n');
}

export function adjustToReviewablePosition(
  lineNumber: number,
  lineMeta: Map<number, LineMeta>,
  hunkPositions: Map<number, number[]>,
): number | null {
  const meta = lineMeta.get(lineNumber);
  if (!meta) return null;
  if (meta.reviewable) return meta.diffPosition;

  const positions = hunkPositions.get(meta.hunkIndex) || [];
  for (const pos of positions) {
    if (pos > lineNumber) {
      const candidate = lineMeta.get(pos);
      if (candidate?.reviewable) return candidate.diffPosition;
    }
  }

  return null;
}
