import type { ReviewMode } from "./config";

function modeInstructions(mode: ReviewMode): string {
  switch (mode) {
    case "strict":
      return [
        "Focus on all potential issues, including minor style problems.",
        "Be thorough and pedantic.",
        "Flag any deviation from best practices."
      ].join(" ");
    case "lenient":
      return [
        "Focus only on critical bugs and security vulnerabilities.",
        "Skip style and minor maintainability issues.",
        "Be concise."
      ].join(" ");
    case "security":
      return [
        "Focus exclusively on security vulnerabilities.",
        "Look for injection attacks, auth issues, data exposure, and insecure defaults."
      ].join(" ");
    case "performance":
      return [
        "Focus exclusively on performance issues.",
        "Look for inefficient algorithms, unnecessary operations, and excessive memory usage."
      ].join(" ");
    case "standard":
    default:
      return [
        "Focus on bugs, security issues, and performance problems.",
        "Include maintainability concerns.",
        "Skip minor style issues unless they impact readability."
      ].join(" ");
  }
}

export function buildPrompt(params: {
  prTitle: string;
  prDescription: string;
  filePath: string;
  reviewMode: ReviewMode;
  reviewInstructions: string;
  numberedDiff: string;
}): string {
  const instructionsBlock = params.reviewInstructions
    ? `Review instructions from repository config:\n${params.reviewInstructions}\n`
    : "";

  return [
    "You are a senior code reviewer.",
    "Provide the response in JSON format:",
    '{"reviews": [{"lineNumber": <diff_line_number>, "reviewComment": "<comment>", "priority": "low|medium|high|critical", "category": "<optional>"}]}',
    "If there are no suggestions, return: {\"reviews\": []}",
    "Use GitHub Markdown in comments.",
    "IMPORTANT: Never suggest adding comments to the code.",
    "The lineNumber must reference the diff line numbers shown at the left.",
    "Only use line numbers for added (+) or context (space) lines.",
    "Do not comment on deleted (-) lines or hunk headers (@@).",
    "",
    `Review mode: ${params.reviewMode}. ${modeInstructions(params.reviewMode)}`,
    "",
    instructionsBlock,
    `File: ${params.filePath}`,
    "",
    `Pull request title: ${params.prTitle}`,
    "Pull request description:",
    "---",
    params.prDescription || "No description provided.",
    "---",
    "",
    "Diff (line numbers included):",
    "```diff",
    params.numberedDiff,
    "```"
  ].join("\n");
}
