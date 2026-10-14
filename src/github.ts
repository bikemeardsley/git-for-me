// What GitHub has for a job (search), and what it says about a repo: whether it exists, and what it is (lookUp).
// GETs to api.github.com, checked against the live API on 2026-10-14. GITHUB_TOKEN, if set, is sent: it raises
// GitHub's search limit from 10 a minute to 30 and finds private repos the token can see. It goes only to
// api.github.com and is never recorded.

export interface Entry {
  id: string; // owner/name, as GitHub spells it: a renamed repo answers with its new name
  exists: boolean | undefined; // undefined: GitHub couldn't be asked (unreachable, rate-limited, down)
  status: number | 'unreachable' | 'invalid id';
  description?: string;
  language?: string;
  license?: string; // an SPDX id, or "other" for a license file GitHub can't identify
  stars?: number;
  pushed?: string;
  archived?: boolean;
  forkOf?: string; // the repo it was forked from
}

const API = 'https://api.github.com';
const ID = /^[A-Za-z0-9-]+\/(?!\.\.?$)[\w.-]+$/; // owner/name; never "." or "..", so the path stays put
const CACHE_MS = 60 * 60 * 1000; // a session asks about the same repos again and again
const TIMEOUT_MS = 15_000;

const headers = (): Record<string, string> => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'git-for-me',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
});

const cache = new Map<string, { at: number; entry: Promise<Entry> }>();

/** GitHub's record of a repo, from a cache an hour fresh. */
export function lookUp(id: string): Promise<Entry> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.entry;
  const entry = fetchEntry(id).then((found) => {
    if (found.exists === undefined) cache.delete(id); // GitHub didn't answer: ask again next time
    return found;
  });
  cache.set(id, { at: Date.now(), entry });
  return entry;
}

async function fetchEntry(id: string): Promise<Entry> {
  if (!ID.test(id)) return { id, exists: false, status: 'invalid id' };
  try {
    const response = await fetch(`${API}/repos/${id}`, { headers: headers(), signal: AbortSignal.timeout(TIMEOUT_MS) });
    // GitHub answers 404 for a repo that doesn't exist and for a private one the token can't see.
    if (response.status === 404) return { id, exists: false, status: 404 };
    if (!response.ok) return { id, exists: undefined, status: response.status }; // 403 and 429 are its rate limit
    const json = await response.json();
    const spdx: string | undefined = json.license?.spdx_id ?? undefined;
    return {
      id: json.full_name ?? id,
      exists: true,
      status: response.status,
      description: json.description ?? undefined,
      language: json.language ?? undefined,
      license: spdx === 'NOASSERTION' ? 'other' : spdx,
      stars: json.stargazers_count,
      pushed: json.pushed_at,
      archived: json.archived,
      forkOf: json.parent?.full_name,
    };
  } catch {
    return { id, exists: undefined, status: 'unreachable' };
  }
}

// Searching, so candidates come from GitHub and not from what an agent remembers. Four ways in, all through the
// repository search: a topic's most starred, and its rising (created in the last half year, most starred first,
// since GitHub has no trending API), names and descriptions holding a keyword, and README text, the nearest thing to
// a web search. Archived repos are left out; forks are, by GitHub's default.

export interface Query { topic?: string; language?: string; keywords?: string[]; phrase?: string }
export interface Hit {
  id: string;
  found: string[]; // how: "most starred in pdf-parser", "rising in pdf-parser", "name or description has pdf", "readme text"
  description?: string;
  language?: string;
  license?: string;
  stars?: number;
  pushed?: string;
  created?: string;
}

const PER_QUERY = 8;
const RISING_DAYS = 182;
const searches = new Map<string, { at: number; hits: Promise<Hit[] | undefined> }>();

/** One query's hits, or undefined if GitHub didn't answer (or limited it); from a cache an hour fresh. */
function ask(q: string, how: string): Promise<Hit[] | undefined> {
  const url = `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_QUERY}`;
  const hit = searches.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.hits;
  const hits = fetch(url, { headers: headers(), signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(async (response) => (response.ok ? (await response.json()).items : undefined))
    .then((items: any[] | undefined) => items?.filter((item) => typeof item?.full_name === 'string').map((item): Hit => {
      const spdx: string | undefined = item.license?.spdx_id ?? undefined;
      return {
        id: item.full_name, found: [how],
        description: item.description?.slice(0, 200) ?? undefined, language: item.language ?? undefined,
        license: spdx === 'NOASSERTION' ? 'other' : spdx,
        stars: item.stargazers_count, pushed: item.pushed_at, created: item.created_at,
      };
    }))
    .catch(() => undefined)
    .then((found) => {
      if (!found) searches.delete(url);
      return found;
    });
  searches.set(url, { at: Date.now(), hits });
  return hits;
}

/**
 * Everything GitHub turns up for a query, taken in turns: each way's first hit, then each way's second, and so on.
 * Sorting the lot by stars would bury what only a keyword or a README found under whatever is popular in the topic,
 * and those are often the closest fit.
 */
export async function search({ topic, language, keywords = [], phrase }: Query): Promise<{ hits: Hit[]; failed: string[] }> {
  const filters = ` archived:false${language ? ` language:"${language}"` : ''}`;
  const tag = topic?.trim().toLowerCase().replace(/\s+/g, '-');
  const since = new Date(Date.now() - RISING_DAYS * 864e5).toISOString().slice(0, 10);
  const queries: [string, string][] = [
    ...(tag ? [[`topic:${tag}${filters}`, `most starred in ${tag}`], [`topic:${tag} created:>${since}${filters}`, `rising in ${tag}`]] as [string, string][] : []),
    ...keywords.map((word): [string, string] => [`${word} in:name,description${filters}`, `name or description has ${word}`]),
    // Quoted: loose words match any README that mentions them all somewhere, and the most starred of those are noise.
    ...(phrase ? [[`"${phrase.replace(/"/g, '')}" in:readme${filters}`, 'readme text']] as [string, string][] : []),
  ];
  const answers = await Promise.all(queries.map(([q, how]) => ask(q, how)));
  const merged = new Map<string, Hit>();
  for (let rank = 0; rank < PER_QUERY; rank++) {
    for (const hit of answers.map((hits) => hits?.[rank])) {
      if (!hit) continue;
      const seen = merged.get(hit.id.toLowerCase()); // GitHub's names are case-insensitive
      if (!seen) merged.set(hit.id.toLowerCase(), { ...hit, found: [...hit.found] });
      else seen.found = [...new Set([...seen.found, ...hit.found])];
    }
  }
  return { hits: [...merged.values()], failed: queries.filter((_, i) => !answers[i]).map(([, how]) => how) };
}
