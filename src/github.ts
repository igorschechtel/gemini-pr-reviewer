import { withRetry } from './retry.js';

export type PRDetails = {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
  headSha?: string;
  baseSha?: string;
  baseBranch?: string;
};

export type ReviewComment = {
  path: string;
  body: string;
  line: number;
  side: 'RIGHT';
  start_line?: number;
  start_side?: 'RIGHT';
};

const API_BASE = 'https://api.github.com';

function buildHeaders(token: string, accept?: string) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'gemini-pr-reviewer',
    Accept: accept || 'application/vnd.github+json',
  };
}

async function requestJson<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  return withRetry(async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...buildHeaders(token),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`GitHub API error ${response.status}: ${body}`);
      (error as Error & { status: number }).status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  }, `github:${path}`);
}

async function requestText(path: string, token: string, accept: string): Promise<string> {
  return withRetry(async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: buildHeaders(token, accept),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`GitHub API error ${response.status}: ${body}`);
      (error as Error & { status: number }).status = response.status;
      throw error;
    }

    return await response.text();
  }, `github:${path}`);
}

interface GitHubPR {
  title: string;
  body: string | null;
  head: { sha: string };
  base: { sha: string; ref: string };
}

export async function fetchPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<PRDetails> {
  const data = await requestJson<GitHubPR>(`/repos/${owner}/${repo}/pulls/${pullNumber}`, token);

  return {
    owner,
    repo,
    pullNumber,
    title: data.title || '',
    body: data.body || '',
    headSha: data.head?.sha,
    baseSha: data.base?.sha,
    baseBranch: data.base?.ref,
  };
}

export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<string> {
  return await requestText(
    `/repos/${owner}/${repo}/pulls/${pullNumber}`,
    token,
    'application/vnd.github.v3.diff',
  );
}

export async function fetchPullRequestCommits(
  owner: string,
  repo: string,
  pullNumber: number,
  token: string,
): Promise<string[]> {
  let allCommits: string[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const commits = await requestJson<{ commit: { message: string } }[]>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=${perPage}&page=${page}`,
      token,
    );
    allCommits = allCommits.concat(commits.map((c) => c.commit.message));
    if (commits.length < perPage) break;
    page++;
  }

  return allCommits;
}

export async function fetchIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string,
): Promise<{ title: string; body: string }> {
  try {
    const issue = await requestJson<{ title: string; body: string }>(
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
      token,
    );
    return { title: issue.title, body: issue.body || '' };
  } catch (e) {
    console.warn(`Failed to fetch issue #${issueNumber}: ${(e as Error).message}`);
    return { title: '', body: '' };
  }
}

export function extractLinkedIssueRefs(
  body: string,
  defaultOwner: string,
  defaultRepo: string,
): { owner: string; repo: string; issueNumber: number }[] {
  const refs: { owner: string; repo: string; issueNumber: number }[] = [];
  const seen = new Set<string>();

  // Patterns:
  // 1. Full URL: https://github.com/owner/repo/issues/123
  // 2. Cross-repo shorthand: owner/repo#123
  // 3. Same-repo shorthand: #123
  const patterns = [
    {
      regex: /https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)/g,
      extract: (m: RegExpExecArray) => {
        const owner = m[1];
        const repo = m[2];
        const num = m[3];
        return owner && repo && num ? { owner, repo, number: parseInt(num, 10) } : null;
      },
    },
    {
      regex: /([^/\s#]+)\/([^/\s#]+)#(\d+)/g,
      extract: (m: RegExpExecArray) => {
        const owner = m[1];
        const repo = m[2];
        const num = m[3];
        return owner && repo && num ? { owner, repo, number: parseInt(num, 10) } : null;
      },
    },
    {
      regex: /(?:\s|^)#(\d+)/g,
      extract: (m: RegExpExecArray) => {
        const num = m[1];
        return num ? { owner: defaultOwner, repo: defaultRepo, number: parseInt(num, 10) } : null;
      },
    },
  ];

  for (const { regex, extract } of patterns) {
    const matches = body.matchAll(regex);
    for (const match of matches) {
      const result = extract(match);
      if (result) {
        const { owner, repo, number } = result;
        const key = `${owner}/${repo}#${number}`;
        if (!seen.has(key)) {
          seen.add(key);
          refs.push({ owner, repo, issueNumber: number });
        }
      }
    }
  }

  return refs;
}

export async function createReview(
  pr: PRDetails,
  token: string,
  body: string,
  comments: ReviewComment[],
): Promise<void> {
  await requestJson(`/repos/${pr.owner}/${pr.repo}/pulls/${pr.pullNumber}/reviews`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body,
      event: 'COMMENT',
      commit_id: pr.headSha,
      comments,
    }),
  });
}

export async function postIssueComment(pr: PRDetails, token: string, body: string): Promise<void> {
  await requestJson(`/repos/${pr.owner}/${pr.repo}/issues/${pr.pullNumber}/comments`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
}

export async function addCommentReaction(
  owner: string,
  repo: string,
  commentId: number,
  reaction: string,
  token: string,
): Promise<void> {
  await requestJson(`/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`, token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ content: reaction }),
  });
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string,
  ref?: string,
): Promise<string> {
  try {
    const query = ref ? `?ref=${ref}` : '';
    const data = await requestJson<{ content: string; encoding: string }>(
      `/repos/${owner}/${repo}/contents/${path}${query}`,
      token,
    );

    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return data.content;
  } catch (e) {
    if ((e as Error & { status?: number }).status === 404) return '';
    throw e;
  }
}

export async function fetchRepoFileStructure(
  owner: string,
  repo: string,
  token: string,
  branch = 'main',
): Promise<string> {
  try {
    const data = await requestJson<{ tree: { path: string; type: string }[] }>(
      `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token,
    );

    // Limit to top 200 files to save context, prioritizing root files and shallow directories
    return data.tree
      .filter((item) => item.type === 'blob')
      .map((item) => item.path)
      .sort((a, b) => {
        const depthA = a.split('/').length;
        const depthB = b.split('/').length;
        return depthA - depthB;
      })
      .slice(0, 200)
      .join('\n');
  } catch (e) {
    console.warn(`Failed to fetch repo structure: ${(e as Error).message}`);
    return '';
  }
}
