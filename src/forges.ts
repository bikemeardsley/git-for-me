// What GitHub, GitLab and Codeberg have for a job (search), and what each says about a repo: whether it exists, and
// what it is (lookUp). GETs only, checked against the live APIs on 2026-10-14. A repo's id is owner/name on GitHub; on
// the others it starts with the host: gitlab.com/group/name (groups nest) and codeberg.org/owner/name. A URL works too.
// GITHUB_TOKEN, if set, goes to api.github.com and nowhere else, and is never recorded: it raises GitHub's search limit
// from 10 a minute to 30 and finds private repos the token can see. GitLab and Codeberg are asked without one.

export type Forge = 'GitHub' | 'GitLab' | 'Codeberg';

export interface Entry {
  id: string; // as its forge spells it: a renamed repo answers with its new name
  exists: boolean | undefined; // undefined: its forge couldn't be asked (unreachable, rate-limited, down)
  status: number | 'unreachable' | 'invalid id' | 'unsupported host';
  description?: string;
  language?: string;
  // An SPDX id (GitLab's in lowercase), "other" for a license file the forge can't identify, or "unknown" on Codeberg,
  // which names no licenses: there it's only known whether there's a license file.
  license?: string;
  stars?: number;
  pushed?: string; // GitHub's last push
  active?: string; // GitLab's and Codeberg's last activity, which a push counts as
  archived?: boolean;
  forkOf?: string; // the repo it was forked from
  mirrorOf?: string; // the URL of the repo a Codeberg mirror copies
}

const GITHUB = 'https://api.github.com';
const GITLAB = 'https://gitlab.com/api';
const CODEBERG = 'https://codeberg.org/api/v1';
const HOSTS: Record<string, Forge> = { 'github.com': 'GitHub', 'gitlab.com': 'GitLab', 'codeberg.org': 'Codeberg' };
const SEGMENT = /^(?!\.\.?$)[\w.-]+$/; // never "." or "..", so the path stays put
const VALID: Record<Forge, (path: string[]) => boolean> = {
  GitHub: ([owner, name, ...rest]) => !rest.length && /^[A-Za-z0-9-]+$/.test(owner) && SEGMENT.test(name ?? ''),
  GitLab: (path) => path.length >= 2 && path.every((part) => SEGMENT.test(part)),
  Codeberg: (path) => path.length === 2 && path.every((part) => SEGMENT.test(part)),
};
const LICENSE_FILE = /^(licen[cs]e|copying|unlicense)([._-]|$)|^licenses$/i; // LICENSE-MIT; LICENSES is a folder of them (REUSE)
const GRAPH = 'query($path: ID!) { project(fullPath: $path) { archived languages { name share } } }';
const CACHE_MS = 60 * 60 * 1000; // a session asks about the same repos again and again
const TIMEOUT_MS = 15_000;

/** The forge an id is on, and its path there: no host means GitHub; a host it doesn't know, no forge. */
export function where(id: string): { forge?: Forge; path: string } {
  const [first = '', ...rest] = id.trim().replace(/^https?:\/\//i, '').replace(/(\.git)?\/*$/i, '').split('/');
  if (!/^([\w-]+\.)+[a-z]{2,}$/i.test(first)) return { forge: 'GitHub', path: [first, ...rest].join('/') };
  return { forge: HOSTS[first.toLowerCase().replace(/^www\./, '')], path: rest.join('/') };
}

const headers = (url: string): Record<string, string> => ({
  'User-Agent': 'git-for-me',
  ...(url.startsWith(GITHUB) ? {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  } : {}),
});

/** Set by the shell commands: a pause of up to a minute fits there, but an MCP client may give up on a call that long. */
export const settings = { wait: false };

/** A GET to a forge's API. A GitHub search over its limit is asked once more when the limit lifts, if that's within a minute and settings.wait. */
async function get(url: string): Promise<Response> {
  const ask = () => fetch(url, { headers: headers(url), signal: AbortSignal.timeout(TIMEOUT_MS) });
  const response = await ask();
  const after = response.headers.get('retry-after');
  const limited = (response.status === 403 || response.status === 429) && (after !== null || response.headers.get('x-ratelimit-remaining') === '0');
  if (!limited || !settings.wait || !url.startsWith(`${GITHUB}/search/`)) return response;
  const wait = after !== null ? Number(after) * 1000 : Number(response.headers.get('x-ratelimit-reset')) * 1000 - Date.now();
  if (!(wait <= 60_000)) return response;
  await new Promise((resolve) => setTimeout(resolve, Math.max(wait, 0) + 1000)); // the reset is in whole seconds
  return ask();
}

const spdx = (license: any) => {
  const id: string | undefined = license?.spdx_id ?? undefined;
  return id === 'NOASSERTION' ? 'other' : id;
};

/** An id as the report spells it: owner/name on GitHub, host first on the others. */
const canonical = (forge: Forge, path: string) => (forge === 'GitHub' ? path : `${forge === 'GitLab' ? 'gitlab.com' : 'codeberg.org'}/${path}`);

// What each forge's record of a repo says, with what a second ask added: GitLab answers whether a project is archived,
// and its languages, only over GraphQL, and Codeberg's file list shows whether there's a license file. A record
// without the repo's name in it isn't one.
const READ: Record<Forge, (json: any, extra: any) => Omit<Entry, 'exists' | 'status'> | undefined> = {
  GitHub: (json) => typeof json?.full_name !== 'string' ? undefined : {
    id: json.full_name, description: json.description ?? undefined, language: json.language ?? undefined,
    license: spdx(json.license), stars: json.stargazers_count, pushed: json.pushed_at, archived: json.archived,
    forkOf: json.parent?.full_name,
  },
  GitLab: (json, graph) => {
    if (typeof json?.path_with_namespace !== 'string') return undefined;
    const project = graph?.data?.project;
    return {
      id: `gitlab.com/${json.path_with_namespace}`, description: json.description || undefined,
      language: project?.languages?.toSorted((a: any, b: any) => b.share - a.share)[0]?.name,
      license: json.license?.key, stars: json.star_count, active: json.last_activity_at, archived: project?.archived,
      forkOf: json.forked_from_project?.path_with_namespace && `gitlab.com/${json.forked_from_project.path_with_namespace}`,
    };
  },
  Codeberg: (json, files) => typeof json?.full_name !== 'string' ? undefined : {
    id: `codeberg.org/${json.full_name}`, description: json.description || undefined, language: json.language || undefined,
    license: Array.isArray(files) && !files.some((file) => LICENSE_FILE.test(file?.name ?? '')) ? undefined : 'unknown',
    stars: json.stars_count, active: json.updated_at, archived: json.archived,
    forkOf: json.parent?.full_name && `codeberg.org/${json.parent.full_name}`,
    mirrorOf: json.mirror ? json.original_url || undefined : undefined,
  },
};

const cache = new Map<string, { at: number; entry: Promise<Entry> }>();

/** Its forge's record of a repo, from a cache an hour fresh. */
export function lookUp(id: string): Promise<Entry> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.entry;
  const entry = fetchEntry(id).then((found) => {
    if (found.exists === undefined) cache.delete(id); // its forge didn't answer: ask again next time
    return found;
  });
  cache.set(id, { at: Date.now(), entry });
  return entry;
}

async function fetchEntry(id: string): Promise<Entry> {
  const { forge, path } = where(id);
  if (!forge) return { id, exists: false, status: 'unsupported host' };
  if (!VALID[forge](path.split('/'))) return { id, exists: false, status: 'invalid id' };
  const name = canonical(forge, path); // what a repo it couldn't read is called: never a URL, which the report would link twice
  const record ={ GitHub: `${GITHUB}/repos/${path}`, GitLab: `${GITLAB}/v4/projects/${encodeURIComponent(path)}?license=true`, Codeberg: `${CODEBERG}/repos/${path}` }[forge];
  const extra = { GitHub: undefined, GitLab: `${GITLAB}/graphql?query=${encodeURIComponent(GRAPH)}&variables=${encodeURIComponent(JSON.stringify({ path }))}`, Codeberg: `${CODEBERG}/repos/${path}/contents` }[forge];
  try {
    const [response, more] = await Promise.all([
      get(record),
      extra && get(extra).then((answer) => (answer.ok ? answer.json() : undefined)).catch(() => undefined),
    ]);
    // Each answers 404 for a repo that doesn't exist and for a private one it won't show.
    if (response.status === 404) return { id: name, exists: false, status: 404 };
    if (!response.ok) return { id: name, exists: undefined, status: response.status }; // GitHub's rate limit is 403 or 429
    const read = READ[forge](await response.json(), more);
    return read ? { ...read, exists: true, status: response.status } : { id: name, exists: undefined, status: 'unreachable' };
  } catch {
    return { id: name, exists: undefined, status: 'unreachable' };
  }
}

// Searching, so candidates come from the forges and not from what an agent remembers. GitHub is searched four ways: a
// topic's most starred, and its rising (created in the last half year, most starred first, since GitHub has no
// trending API), names and descriptions holding a keyword, and README text, the nearest thing to a web search. GitLab
// and Codeberg are searched by topic and keyword: their repo searches have no README text, and no filter by creation
// date. Archived repos are left out everywhere, and forks on GitHub and Codeberg (mirrors too, there).

export interface Query { topic?: string; language?: string; keywords?: string[]; phrase?: string }
export interface Hit {
  id: string;
  found: string[]; // how: "most starred in pdf-parser", "rising in pdf-parser", "name or description has pdf", "readme text"
  description?: string;
  language?: string;
  license?: string; // GitHub's alone: GitLab and Codeberg leave licenses out of a search
  stars?: number;
  pushed?: string;
  active?: string;
  created?: string;
}
interface Way { forge: Forge; how: string; url: string; items: (json: any) => Omit<Hit, 'found'>[] | undefined }

const PER_QUERY = 8;
const RISING_DAYS = 182;
const searches = new Map<string, { at: number; hits: Promise<Hit[] | undefined> }>();
const named = (items: unknown, key: string): any[] | undefined => (Array.isArray(items) ? items.filter((item) => typeof item?.[key] === 'string') : undefined);
const about = (text: unknown) => (typeof text === 'string' && text ? text.slice(0, 200) : undefined);

const github = (q: string, how: string): Way => ({
  forge: 'GitHub', how,
  url: `${GITHUB}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_QUERY}`,
  items: (json) => named(json?.items, 'full_name')?.map((item) => ({
    id: item.full_name, description: about(item.description), language: item.language ?? undefined, license: spdx(item.license),
    stars: item.stargazers_count, pushed: item.pushed_at, created: item.created_at,
  })),
});
const gitlab = (filter: string, how: string, language?: string): Way => ({
  forge: 'GitLab', how,
  url: `${GITLAB}/v4/projects?${filter}${language ? `&with_programming_language=${encodeURIComponent(language)}` : ''}&archived=false&order_by=star_count&sort=desc&per_page=${PER_QUERY}&simple=true`,
  items: (json) => named(json, 'path_with_namespace')?.map((item) => ({
    id: `gitlab.com/${item.path_with_namespace}`, description: about(item.description),
    stars: item.star_count, active: item.last_activity_at, created: item.created_at,
  })),
});
const codeberg = (filter: string, how: string, languages: string[]): Way => ({
  forge: 'Codeberg', how,
  url: `${CODEBERG}/repos/search?${filter}&mode=source&archived=false&sort=stars&order=desc&limit=${PER_QUERY}`,
  // It can't filter by language, so that's done here, by each repo's main language, as GitHub does.
  items: (json) => named(json?.data, 'full_name')?.filter((item) => !languages.length || languages.includes(item.language?.toLowerCase())).map((item) => ({
    id: `codeberg.org/${item.full_name}`, description: about(item.description), language: item.language || undefined,
    stars: item.stars_count, active: item.updated_at, created: item.created_at,
  })),
});

/** One way's hits, or undefined if its forge didn't answer (or limited it); from a cache an hour fresh. */
function ask({ url, how, items }: Way): Promise<Hit[] | undefined> {
  const hit = searches.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.hits;
  const hits = get(url)
    .then(async (response) => (response.ok ? items(await response.json())?.map((item) => ({ ...item, found: [how] })) : undefined))
    .catch(() => undefined)
    .then((found) => {
      if (!found) searches.delete(url);
      return found;
    });
  searches.set(url, { at: Date.now(), hits });
  return hits;
}

/**
 * Everything the forges turn up for a query, taken in turns: each way's first hit, then each way's second, and so on.
 * Sorting the lot by stars would bury what only a keyword or a README found under whatever is popular in the topic,
 * and those are often the closest fit.
 */
export async function search({ topic, language, keywords = [], phrase }: Query): Promise<{ hits: Hit[]; failed: { forge: Forge; how: string }[] }> {
  // "typescript, javascript": a stack that can use either; GitHub takes repos in any of them.
  const languages = (language ?? '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
  const filters = ` archived:false${languages.map((name) => ` language:"${name}"`).join('')}`;
  // GitLab filters by one language at most, and gives up (a 500, after 15 seconds) on a common word filtered by one.
  const one = languages.length === 1 ? languages[0] : undefined;
  const anyLanguage = (filtered?: string) => (languages.length && !filtered ? ' (any language)' : '');
  const tag = topic?.trim().toLowerCase().replace(/\s+/g, '-');
  const since = new Date(Date.now() - RISING_DAYS * 864e5).toISOString().slice(0, 10);
  const ways: Way[] = [
    ...(tag ? [github(`topic:${tag}${filters}`, `most starred in ${tag}`), github(`topic:${tag} created:>${since}${filters}`, `rising in ${tag}`)] : []),
    ...keywords.map((word) => github(`${word} in:name,description${filters}`, `name or description has ${word}`)),
    // Quoted: loose words match any README that mentions them all somewhere, and the most starred of those are noise.
    ...(phrase ? [github(`"${phrase.replace(/"/g, '')}" in:readme${filters}`, 'readme text')] : []),
    ...(tag ? [gitlab(`topic=${encodeURIComponent(tag)}`, `most starred in ${tag}${anyLanguage(one)}`, one), codeberg(`q=${encodeURIComponent(tag)}&topic=true`, `most starred in ${tag}`, languages)] : []),
    ...keywords.flatMap((word) => [
      gitlab(`search=${encodeURIComponent(word)}`, `name or description has ${word}${anyLanguage()}`),
      codeberg(`q=${encodeURIComponent(word)}&includeDesc=true`, `name or description has ${word}`, languages),
    ]),
  ];
  const answers = await Promise.all(ways.map(ask));
  const merged = new Map<string, Hit>();
  for (let rank = 0; rank < PER_QUERY; rank++) {
    for (const hit of answers.map((hits) => hits?.[rank])) {
      if (!hit) continue;
      const seen = merged.get(hit.id.toLowerCase()); // the forges' names are case-insensitive
      if (!seen) merged.set(hit.id.toLowerCase(), { ...hit, found: [...hit.found] });
      else seen.found = [...new Set([...seen.found, ...hit.found])];
    }
  }
  return { hits: [...merged.values()], failed: ways.filter((_, i) => !answers[i]).map(({ forge, how }) => ({ forge, how })) };
}
