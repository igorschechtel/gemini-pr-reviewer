import { describe, expect, test } from "bun:test";
import { buildPrompt } from "../src/prompt";

describe("prompt builder", () => {
  test("includes review instructions when provided", () => {
    const prompt = buildPrompt({
      prTitle: "Add feature",
      prDescription: "Test description",
      filePath: "src/foo.ts",
      reviewMode: "standard",
      reviewInstructions: "Focus on correctness and security.",
      numberedDiff: "1 | @@ -1,1 +1,1 @@\n2 | +const a = 1;"
    });

    expect(prompt).toContain("Review instructions from repository config:");
    expect(prompt).toContain("Focus on correctness and security.");
    expect(prompt).toContain("Diff (line numbers included):");
  });

  test("includes global context when provided", () => {
    const prompt = buildPrompt({
      prTitle: "Add feature",
      prDescription: "Test description",
      filePath: "src/foo.ts",
      reviewMode: "standard",
      reviewInstructions: "",
      numberedDiff: "1 | @@ -1,1 +1,1 @@\n2 | +const a = 1;",
      globalSummary: "Cross-file summary.",
      globalFindings: ["Ensure API changes are reflected in docs."]
    });

    expect(prompt).toContain("Global PR context");
    expect(prompt).toContain("Cross-file summary.");
    expect(prompt).toContain("Ensure API changes are reflected in docs.");
  });
});
