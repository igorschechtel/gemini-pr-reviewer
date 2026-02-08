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

import { fetchFileContent, fetchRepoFileStructure } from '../src/github.ts';

describe('fetchFileContent', () => {
  const originalFetch = global.fetch;

  test('fetches and decodes base64 content', async () => {
    const mockContent = 'Hello World';
    const mockBase64 = Buffer.from(mockContent).toString('base64');

    global.fetch = (async () => ({
      ok: true,
      json: async () => ({ content: mockBase64, encoding: 'base64' }),
    })) as unknown as typeof fetch;

    const content = await fetchFileContent('owner', 'repo', 'path', 'token');
    expect(content).toBe(mockContent);

    global.fetch = originalFetch;
  });

  test('returns empty string on 404', async () => {
    global.fetch = (async () => ({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    })) as unknown as typeof fetch;

    const content = await fetchFileContent('owner', 'repo', 'missing', 'token');
    expect(content).toBe('');

    global.fetch = originalFetch;
  });
});

describe('fetchRepoFileStructure', () => {
  const originalFetch = global.fetch;

  test('fetches tree and filters blobs', async () => {
    const mockTree = {
      tree: [
        { path: 'src/index.ts', type: 'blob' },
        { path: 'src', type: 'tree' },
        { path: 'README.md', type: 'blob' },
      ],
    };

    global.fetch = (async () => ({
      ok: true,
      json: async () => mockTree,
    })) as unknown as typeof fetch;

    const structure = await fetchRepoFileStructure('owner', 'repo', 'token');
    const lines = structure.split('\n');
    expect(lines).toContain('src/index.ts');
    expect(lines).toContain('README.md');
    expect(lines).not.toContain('src'); // filtered out tree

    global.fetch = originalFetch;
  });
});
