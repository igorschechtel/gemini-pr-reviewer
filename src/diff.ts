import parseDiff from "parse-diff";
import { minimatch } from "minimatch";

export type DiffLine = {
  content: string;
  type: "add" | "del" | "normal";
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

  const files = parseDiff(diffText) as any[];
  const results: DiffFile[] = [];

  for (const file of files) {
    const rawPath: string | undefined = file.to || file.from;
    if (!rawPath) continue;
    const path = rawPath.replace(/^b\//, "").replace(/^a\//, "");

    const hunks: DiffHunk[] = [];
    const chunks = file.chunks || [];

    for (const chunk of chunks) {
      const header = (chunk.content || "").trimEnd();
      const changes = chunk.changes || [];
      const lines: DiffLine[] = changes.map((change: any) => ({
        content: change.content,
        type: change.type,
        oldNumber: change.ln1 ?? (change.type === "del" ? change.ln : undefined),
        newNumber: change.ln2 ?? (change.type === "add" ? change.ln : undefined)
      }));

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
      const matchesInclude = options.includePatterns.some((pattern) => minimatch(file.path, pattern));
      if (!matchesInclude) continue;
    }

    if (options.excludePatterns.length > 0) {
      const matchesExclude = options.excludePatterns.some((pattern) => minimatch(file.path, pattern));
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

  let position = 0;

  const hunks = file.hunks.slice(0, options.maxHunksPerFile);

  hunks.forEach((hunk, hunkIndex) => {
    position += 1;
    lines.push(`${position} | ${hunk.header}`);
    lineMeta.set(position, {
      position,
      reviewable: false,
      hunkIndex,
      content: hunk.header
    });
    hunkPositions.set(hunkIndex, [position]);

    const limitedLines = hunk.lines.slice(0, options.maxLinesPerHunk);
    for (const line of limitedLines) {
      position += 1;
      lines.push(`${position} | ${line.content}`);

      const reviewable =
        (line.type === "add" || line.type === "normal") &&
        !line.content.startsWith("\\ No newline");

      lineMeta.set(position, {
        position,
        reviewable,
        hunkIndex,
        content: line.content
      });

      const positions = hunkPositions.get(hunkIndex) || [];
      positions.push(position);
      hunkPositions.set(hunkIndex, positions);
    }
  });

  return { lines, lineMeta, hunkPositions };
}

export function buildGlobalDiff(
  files: DiffFile[],
  options: DiffParseOptions,
  maxLines: number
): string {
  if (maxLines <= 0) return "";

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
      if (!pushLine(hunk.header)) return lines.join("\n");

      const limitedLines = hunk.lines.slice(0, options.maxLinesPerHunk);
      for (const line of limitedLines) {
        if (!pushLine(line.content)) return lines.join("\n");
      }
    }
  }

  return lines.join("\n");
}

export function adjustToReviewablePosition(
  lineNumber: number,
  lineMeta: Map<number, LineMeta>,
  hunkPositions: Map<number, number[]>
): number | null {
  const meta = lineMeta.get(lineNumber);
  if (!meta) return null;
  if (meta.reviewable) return lineNumber;

  const positions = hunkPositions.get(meta.hunkIndex) || [];
  for (const pos of positions) {
    if (pos > lineNumber) {
      const candidate = lineMeta.get(pos);
      if (candidate?.reviewable) return pos;
    }
  }

  return null;
}
