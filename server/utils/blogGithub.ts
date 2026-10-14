interface GithubConfig {
  token: string
  owner: string
  repo: string
  branch: string
}

export interface CommitAuthor {
  name: string
  email: string
}

interface ContentsApiResponse {
  sha?: string
  content?: string
  encoding?: string
}

const GITHUB_API = 'https://api.github.com'

export function getBlogGithubConfig(): GithubConfig {
  const token = (process.env.BLOG_GITHUB_TOKEN || '').trim()
  if (!token) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Blog publishing is not configured. Set BLOG_GITHUB_TOKEN in the environment.',
    })
  }
  return {
    token,
    owner: process.env.BLOG_GITHUB_OWNER || 'novelacadhost-sketch',
    repo: process.env.BLOG_GITHUB_REPO || 'NOVELSOLARWEB',
    branch: process.env.BLOG_GITHUB_BRANCH || 'master',
  }
}

function authHeaders(cfg: GithubConfig) {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'NovelSolar-BlogManager',
  }
}

function contentsUrl(cfg: GithubConfig, filePath: string) {
  return `${GITHUB_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(filePath)}`
}

async function ghFetch<T = any>(url: string, init: any, cfg: GithubConfig): Promise<T> {
  try {
    return await $fetch<T>(url, {
      ...init,
      headers: { ...authHeaders(cfg), ...(init?.headers || {}) },
    })
  } catch (err: any) {
    const status = err?.statusCode || err?.response?.status || 502
    const apiMessage = err?.data?.message || err?.response?._data?.message || err?.message || 'GitHub request failed.'
    throw createError({
      statusCode: status === 404 ? 404 : 502,
      statusMessage: `GitHub: ${apiMessage}`,
    })
  }
}

export async function getRemoteFile(filePath: string): Promise<{ sha: string; content: string } | null> {
  const cfg = getBlogGithubConfig()
  try {
    const data = await ghFetch<ContentsApiResponse>(
      `${contentsUrl(cfg, filePath)}?ref=${encodeURIComponent(cfg.branch)}`,
      { method: 'GET' },
      cfg,
    )
    if (!data?.sha) return null
    const decoded =
      data.content && data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf8') : ''
    return { sha: data.sha, content: decoded }
  } catch (err: any) {
    if (err?.statusCode === 404) return null
    throw err
  }
}

/** File names in a repo directory on the publishing branch; [] if the directory does not exist. */
export async function listRemoteDirectory(dirPath: string): Promise<{ name: string; path: string }[]> {
  const cfg = getBlogGithubConfig()
  try {
    const entries = await ghFetch<{ name: string; path: string; type: string }[]>(
      `${contentsUrl(cfg, dirPath)}?ref=${encodeURIComponent(cfg.branch)}`,
      { method: 'GET' },
      cfg,
    )
    return (Array.isArray(entries) ? entries : []).filter((e) => e.type === 'file')
  } catch (err: any) {
    if (err?.statusCode === 404) return []
    throw err
  }
}

export async function putRemoteFile(params: {
  filePath: string
  content: string
  message: string
  author: CommitAuthor
  sha?: string
}): Promise<{ sha: string; commitSha: string }> {
  const cfg = getBlogGithubConfig()
  const body: Record<string, unknown> = {
    message: params.message,
    content: Buffer.from(params.content, 'utf8').toString('base64'),
    branch: cfg.branch,
    committer: params.author,
    author: params.author,
  }
  if (params.sha) body.sha = params.sha

  const result = await ghFetch<{ content: { sha: string }; commit: { sha: string } }>(
    contentsUrl(cfg, params.filePath),
    { method: 'PUT', body },
    cfg,
  )
  return { sha: result.content?.sha, commitSha: result.commit?.sha }
}

export async function deleteRemoteFile(params: {
  filePath: string
  message: string
  author: CommitAuthor
  sha: string
}): Promise<{ commitSha: string }> {
  const cfg = getBlogGithubConfig()
  const result = await ghFetch<{ commit: { sha: string } }>(
    contentsUrl(cfg, params.filePath),
    {
      method: 'DELETE',
      body: {
        message: params.message,
        branch: cfg.branch,
        committer: params.author,
        author: params.author,
        sha: params.sha,
      },
    },
    cfg,
  )
  return { commitSha: result.commit?.sha }
}

export function commitMessageFor(action: 'publish' | 'update' | 'delete', slug: string) {
  return `blog: ${action} ${slug}`
}

export function adminToCommitAuthor(admin: { email?: string; user_id?: string } | undefined): CommitAuthor {
  const email = admin?.email?.trim() || 'blog@novelsolar.com'
  const name = admin?.email?.split('@')[0] || admin?.user_id || 'NovelSolar Admin'
  return { name, email }
}
