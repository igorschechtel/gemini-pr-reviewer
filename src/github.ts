export type PRDetails = {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
  headSha?: string;
  baseSha?: string;
};

export type ReviewComment = {
  path: string;
  position: number;
  body: string;
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
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(token),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

async function requestText(path: string, token: string, accept: string): Promise<string> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(token, accept),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  return await response.text();
}

interface GitHubPR {
  title: string;
  body: string | null;
  head: { sha: string };
  base: { sha: string };
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
  const commits = await requestJson<{ commit: { message: string } }[]>(
    `/repos/${owner}/${repo}/pulls/${pullNumber}/commits`,
    token,
  );
  return commits.map((c) => c.commit.message);
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
): { owner: string; repo: string; issueNumber: number }[] {
  const pattern = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/g;
  const matches = [...body.matchAll(pattern)];

  const refs: { owner: string; repo: string; issueNumber: number }[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const owner = match[1] as string;
    const repo = match[2] as string;
    const numberStr = match[3] as string;

    if (owner && repo && numberStr) {
      const issueNumber = parseInt(numberStr, 10);
      const key = `${owner}/${repo}#${issueNumber}`;

      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ owner, repo, issueNumber });
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
