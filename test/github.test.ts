import { describe, expect, test } from 'bun:test';
import { extractLinkedIssueRefs } from '../src/github.ts';

describe('extractLinkedIssueRefs', () => {
  const defaultOwner = 'google';
  const defaultRepo = 'gemini';

  test('extracts full GitHub URLs', () => {
    const body = 'Fixes https://github.com/owner/repo/issues/123';
    const refs = extractLinkedIssueRefs(body, defaultOwner, defaultRepo);
    expect(refs).toEqual([{ owner: 'owner', repo: 'repo', issueNumber: 123 }]);
  });

  test('extracts cross-repo shorthand owner/repo#123', () => {
    const body = 'Related to acme/rocket#456 and more text';
    const refs = extractLinkedIssueRefs(body, defaultOwner, defaultRepo);
    expect(refs).toEqual([{ owner: 'acme', repo: 'rocket', issueNumber: 456 }]);
  });

  test('extracts same-repo shorthand #123', () => {
    const body = 'Closes #789';
    const refs = extractLinkedIssueRefs(body, defaultOwner, defaultRepo);
    expect(refs).toEqual([{ owner: 'google', repo: 'gemini', issueNumber: 789 }]);
  });

  test('handles multiple references of different formats', () => {
    const body = `
      Check out #1 and acme/tools#2.
      Also see https://github.com/org/repo/issues/3
    `;
    const refs = extractLinkedIssueRefs(body, defaultOwner, defaultRepo);
    expect(refs).toEqual([
      { owner: 'org', repo: 'repo', issueNumber: 3 },
      { owner: 'acme', repo: 'tools', issueNumber: 2 },
      { owner: 'google', repo: 'gemini', issueNumber: 1 },
    ]);
  });

  test('avoids duplicate references', () => {
    const body = 'Fixes #123 and also #123';
    const refs = extractLinkedIssueRefs(body, defaultOwner, defaultRepo);
    expect(refs).toHaveLength(1);
    expect(refs[0]?.issueNumber).toBe(123);
  });

  test('ignores text that looks like shorthand but is not', () => {
    const body = 'This is not an issue #abc or # or /#123';
    const refs = extractLinkedIssueRefs(body, defaultOwner, defaultRepo);
    expect(refs).toEqual([]);
  });
});
