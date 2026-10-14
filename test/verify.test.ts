import assert from 'node:assert/strict';
import { test } from 'node:test';
import { settings, type Query } from '../src/forges.ts';
import { find } from '../src/search.ts';
import { verify } from '../src/verify.ts';

const now = new Date().toISOString();
// A small GitHub; any repo not on it gets the real one's answer for a missing repo, a 404.
const REPOS: Record<string, object> = {
  'acme/reader': { full_name: 'acme/reader', description: 'Reads tables out of PDFs', language: 'Python', license: { spdx_id: 'MIT' }, stargazers_count: 12_000, pushed_at: now, archived: false },
  'acme/old': { full_name: 'acme/old', language: 'Python', license: null, stargazers_count: 12, pushed_at: '2020-01-01T00:00:00Z', archived: true },
  'acme/gpl': { full_name: 'acme/gpl', language: 'C', license: { spdx_id: 'GPL-3.0' }, stargazers_count: 900, pushed_at: now },
  'acme/odd': { full_name: 'acme/odd', license: { spdx_id: 'NOASSERTION' }, stargazers_count: 300, pushed_at: now },
  'acme/fork': { full_name: 'acme/fork', license: { spdx_id: 'MIT' }, stargazers_count: 80, pushed_at: now, parent: { full_name: 'upstream/fork' } },
  'acme/flaky': { full_name: 'acme/flaky', license: { spdx_id: 'MIT' }, stargazers_count: 500, pushed_at: now }, // once it answers
  'acme/renamed': { full_name: 'acme/new-name', license: { spdx_id: 'MIT' }, stargazers_count: 500, pushed_at: now }, // GitHub follows a rename
  'acme/mpl': { full_name: 'acme/mpl', license: { spdx_id: 'MPL-2.0' }, stargazers_count: 500, pushed_at: now },
  'acme/garbled': { message: 'not a repo' }, // an answer with no repo in it
  'acme/readme-only': { full_name: 'acme/readme-only', license: { spdx_id: 'MIT' }, stargazers_count: 30, pushed_at: now },
};
// Its search, by query, the rising cutoff date aside. A query not here finds nothing.
const SEARCH: Record<string, object[]> = {
  'topic:pdf-parser archived:false language:"python"': [REPOS['acme/reader'], { full_name: 'acme/popular', stargazers_count: 50_000, language: 'Python', license: { spdx_id: 'Apache-2.0' } }],
  'topic:pdf-parser created:>DATE archived:false language:"python"': [{ full_name: 'acme/new-hot', stargazers_count: 400, created_at: now }],
  'reader in:name,description archived:false language:"python"': [REPOS['acme/reader'], { stargazers_count: 5 }], // an item with no name is no hit
  '"tables" in:readme archived:false language:"python"': [{ full_name: 'Acme/Reader' }, { full_name: 'acme/readme-only', stargazers_count: 30 }], // acme/reader, spelled another way
};
// A small GitLab: each project's record, then what its GraphQL adds; and its search, by filter.
const GITLAB: Record<string, [object, object]> = {
  'lab/reader': [{ path_with_namespace: 'lab/reader', description: 'Reads tables, on GitLab', license: { key: 'gpl-3.0' }, star_count: 700, last_activity_at: now },
    { archived: true, languages: [{ name: 'C', share: 10 }, { name: 'Python', share: 90 }] }],
  'lab/sub/fork': [{ path_with_namespace: 'lab/sub/fork', license: { key: 'mit' }, star_count: 60, last_activity_at: now, forked_from_project: { path_with_namespace: 'lab/upstream' } },
    { archived: false, languages: [] }],
};
const GITLAB_SEARCH: Record<string, object[]> = {
  'topic=pdf-parser&with_programming_language=python': [GITLAB['lab/reader'][0]],
  'search=reader': [GITLAB['lab/reader'][0], { star_count: 5 }], // no path, no hit
};
// A small Codeberg: each repo with the names in its top folder; and its search, by query.
const CODEBERG: Record<string, [object, string[]]> = {
  'berg/tool': [{ full_name: 'berg/tool', language: 'Python', stars_count: 90, updated_at: now, mirror: true, original_url: 'https://github.com/acme/tool' }, ['LICENSE-MIT', 'README.md']],
  'berg/bare': [{ full_name: 'berg/bare', language: 'Go', stars_count: 3, updated_at: '2020-01-01T00:00:00Z' }, ['main.go']],
};
const CODEBERG_SEARCH: Record<string, object[]> = {
  'q=pdf-parser&topic=true': [CODEBERG['berg/tool'][0], { full_name: 'berg/in-go', language: 'Go', stars_count: 999 }], // not Python, so left out
};
const asked: { url: URL; authorization: string | null }[] = [];
let flaky = 0;
let limited = 0; // GitHub searches still to turn away, as over its limit
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  asked.push({ url, authorization: new Headers(init?.headers).get('authorization') });
  const filter = (...keys: string[]) => keys.filter((key) => url.searchParams.has(key)).map((key) => `${key}=${url.searchParams.get(key)}`).join('&');
  const missing = () => new Response('Not Found', { status: 404 });
  if (url.host === 'gitlab.com') {
    if (url.pathname === '/api/graphql') return Response.json({ data: { project: GITLAB[JSON.parse(url.searchParams.get('variables')!).path.toLowerCase()]?.[1] ?? null } });
    if (url.pathname === '/api/v4/projects') return Response.json(GITLAB_SEARCH[filter('topic', 'search', 'with_programming_language')] ?? []);
    const project = GITLAB[decodeURIComponent(url.pathname.replace('/api/v4/projects/', '')).toLowerCase()]; // its paths are case-insensitive
    return project ? Response.json(project[0]) : missing();
  }
  if (url.host === 'codeberg.org') {
    if (url.pathname === '/api/v1/repos/search') return Response.json({ ok: true, data: CODEBERG_SEARCH[filter('q', 'topic', 'includeDesc')] ?? [] });
    const [, repo, contents] = /^\/api\/v1\/repos\/([^/]+\/[^/]+)(\/contents)?$/.exec(url.pathname) ?? [];
    if (!CODEBERG[repo]) return missing();
    return Response.json(contents ? CODEBERG[repo][1].map((name) => ({ name, type: 'file' })) : CODEBERG[repo][0]);
  }
  const q = url.searchParams.get('q');
  if (url.pathname === '/search/repositories') {
    if (q?.startsWith('limited')) return new Response('API rate limit exceeded', { status: 403 });
    if (limited > 0 && limited--) return new Response('API rate limit exceeded', { status: 403, headers: { 'retry-after': '0' } });
    return Response.json({ items: SEARCH[(q ?? '').replace(/created:>\d{4}-\d{2}-\d{2}/, 'created:>DATE')] ?? [] });
  }
  const id = url.pathname.replace('/repos/', '');
  if (id === 'acme/flaky' && !flaky++) throw new TypeError('fetch failed');
  return REPOS[id] ? Response.json(REPOS[id]) : missing();
};

const QUERY: Query = { topic: 'PDF Parser', language: 'python', keywords: ['reader'], phrase: 'tables' }; // the topic as an agent might write it
const part = (id: string, verdict: 'USE' | 'ADAPT' | 'BUILD' | 'WRITE', candidates: string[],
  search: Query | Query[] | undefined = verdict === 'WRITE' ? undefined : { keywords: [id] }) =>
  ({ id, name: id, role: `${id}'s job`, verdict, rationale: `why ${id}`, candidates: candidates.map((candidate) => ({ id: candidate })), search });

test("puts the search's picks first, drops what isn't there and flags what bites", async () => {
  process.env.GITHUB_TOKEN = 'ghp_secret_test_token';
  const { markdown, result } = await verify({
    need: 'pull tables out of PDFs',
    components: [
      part('reader', 'USE', ['acme/made-up', 'acme/old', 'acme/reader', 'acme/gpl'], QUERY),
      part('odds', 'ADAPT', ['acme/odd', 'acme/fork', 'acme/renamed', 'acme/mpl']),
      part('flaky', 'USE', ['https://github.com/acme/flaky', 'acme/garbled']),
      part('glue', 'WRITE', []),
      part('lab', 'ADAPT', ['https://GitLab.com/Lab/Reader/', 'gitlab.com/lab/sub/fork', 'gitlab.gnome.org/GNOME/gtk']),
      part('berg', 'USE', ['codeberg.org/berg/tool', 'codeberg.org/berg/bare']),
    ],
  });
  delete process.env.GITHUB_TOKEN;
  const [reader, odds, flaky, glue, lab, berg] = result.components;

  // The search's pick heads the part, though named after two it didn't turn up; those follow, from memory.
  assert.deepEqual([reader.repo?.id, reader.repo?.found], ['acme/reader', ['most starred in pdf-parser', 'name or description has reader', 'readme text']]);
  assert.deepEqual(reader.alternates.map((entry) => [entry.id, entry.flags, entry.found]),
    [['acme/old', ['ARCHIVED', 'NO_LICENSE', 'STALE', 'LITTLE_USED'], []], ['acme/gpl', ['COPYLEFT'], []]]);
  assert.deepEqual(reader.dropped, ['acme/made-up']);
  // In turns, one way after another; what other parts picked, whatever they called it, isn't "not picked".
  assert.deepEqual(reader.unpicked.map((hit) => hit.id), ['acme/new-hot', 'acme/popular', 'acme/readme-only']);

  assert.deepEqual([odds.repo?.id, odds.repo?.flags], ['acme/odd', ['OWN_TERMS']]);
  assert.deepEqual(odds.alternates.map((entry) => [entry.id, entry.flags, entry.forkOf]),
    [['acme/fork', ['FORK'], 'upstream/fork'], ['acme/new-name', [], undefined], ['acme/mpl', ['WEAK_COPYLEFT'], undefined]]);
  // Kept, as GitHub didn't say they're missing, under the name the report links: never a URL.
  assert.deepEqual([flaky.repo, ...flaky.alternates].map((entry) => [entry?.id, entry?.flags]), [['acme/flaky', ['UNCHECKED']], ['acme/garbled', ['UNCHECKED']]]);
  assert.deepEqual([reader, odds, flaky, glue, lab, berg].map((p) => p.missing), [false, false, false, false, false, false]);
  assert.equal(result.nextAction, 'DONE');

  // GitLab: a URL is a name too; archived and the main language come from its GraphQL, the license from its record.
  assert.deepEqual([lab.repo?.id, lab.repo?.language, lab.repo?.flags, lab.repo?.found], ['gitlab.com/lab/reader', 'Python', ['ARCHIVED', 'COPYLEFT'], ['most starred in pdf-parser', 'name or description has reader (any language)']]);
  assert.deepEqual(lab.alternates.map((entry) => [entry.id, entry.flags, entry.forkOf]), [['gitlab.com/lab/sub/fork', ['FORK'], 'gitlab.com/lab/upstream']]);
  assert.deepEqual(lab.dropped, ['gitlab.gnome.org/GNOME/gtk']);
  assert.ok(!asked.some((call) => call.url.host === 'gitlab.gnome.org')); // a forge it can't check is never asked
  // Codeberg names no licenses: a license file is read, and no file is no license.
  assert.deepEqual([berg.repo?.id, berg.repo?.flags, berg.repo?.mirrorOf], ['codeberg.org/berg/tool', ['UNKNOWN_LICENSE', 'MIRROR'], 'https://github.com/acme/tool']);
  assert.deepEqual(berg.alternates.map((entry) => [entry.id, entry.flags, entry.found]), [['codeberg.org/berg/bare', ['NO_LICENSE', 'STALE', 'LITTLE_USED'], []]]);

  assert.match(markdown, /\*\*Repo: \[acme\/reader\]\(https:\/\/github\.com\/acme\/reader\)\*\*\n_Reads tables out of PDFs_\nPython {2}· {2}license MIT {2}· {2}12\.0k stars {2}· {2}pushed today {2}· {2}found: most starred in pdf-parser, name or description has reader, readme text\n/);
  assert.match(markdown, /\*\*Repo: \[acme\/odd\]\(https:\/\/github\.com\/acme\/odd\)\*\* _from memory: the search didn't turn it up_/);
  assert.match(markdown, /Also: \[acme\/old\]\(https:\/\/github\.com\/acme\/old\) \(archived, no license, stale, little used, from memory\) {2}· {2}\[acme\/gpl\]\(https:\/\/github\.com\/acme\/gpl\) \(copyleft, from memory\)/);
  assert.match(markdown, /\*\*Repo: \[gitlab\.com\/lab\/reader\]\(https:\/\/gitlab\.com\/lab\/reader\)\*\*\n_Reads tables, on GitLab_\nPython {2}· {2}license gpl-3\.0 {2}· {2}700 stars {2}· {2}active today {2}· {2}found: /);
  assert.match(markdown, /90 stars {2}· {2}active today {2}· {2}mirror of https:\/\/github\.com\/acme\/tool/);
  assert.match(markdown, /Watch out: Codeberg doesn't say which license it has: read it before reusing the code; a mirror: pick the original it copies\./);
  assert.match(markdown, /Dropped, on a forge it can't check \(only GitHub, GitLab\.com and Codeberg\): gitlab\.gnome\.org\/GNOME\/gtk/);
  assert.match(markdown, /\*\*Repo: \[acme\/flaky\]\(https:\/\/github\.com\/acme\/flaky\)\*\*/);
  assert.match(markdown, /\[acme\/mpl\]\(https:\/\/github\.com\/acme\/mpl\) \(weak copyleft, from memory\)/);
  assert.match(markdown, /15 named, 10 from memory rather than the search, 1 not there and dropped, 1 on a forge it can't check, 2 left unchecked as their forges didn't answer\._/);
  assert.match(markdown, /The search also found, not picked:\n- \[acme\/new-hot\]\(https:\/\/github\.com\/acme\/new-hot\) \(400 stars\): found as rising in pdf-parser\n/);
  assert.match(markdown, /No repo: write this one/);

  // The token goes to GitHub, and nowhere else: not to the other forges, and not into the report or the JSON.
  assert.ok(asked.some((call) => call.url.host === 'gitlab.com') && asked.some((call) => call.url.host === 'codeberg.org'));
  assert.ok(asked.every((call) => call.authorization === (call.url.host === 'api.github.com' ? 'Bearer ghp_secret_test_token' : null)));
  assert.doesNotMatch(markdown + JSON.stringify(result), /ghp_secret/);
});

test('sends the agent to search first, back for parts left with nothing, and a BUILD verdict shows what the search found', async () => {
  const before = asked.length;
  const { result, markdown } = await verify({
    need: 'pull tables out of PDFs',
    components: [
      { ...part('guess', 'USE', ['acme/reader']), search: undefined },
      part('gone', 'USE', ['acme/gone', '../../evil', 'codeberg.org/../evil']),
      part('maker', 'BUILD', [], { topic: 'pdf-parser', language: 'python' }),
      part('empty', 'ADAPT', ['acme/gpl'], {}), // a search for nothing is no search
      // Searched twice: a pick only the first search found was still found, not remembered.
      part('again', 'USE', ['acme/readme-only'], [{ language: 'python', phrase: 'tables' }, { keywords: ['other-words'] }]),
    ],
  });
  assert.equal(result.nextAction, 'SEARCH_FIRST');
  assert.deepEqual(result.components.map((p) => [p.unsearched, p.missing]), [[true, false], [false, true], [false, false], [true, false], [false, false]]);
  assert.deepEqual(result.components[4].repo?.found, ['readme text']);
  assert.match(result.instructions, /picked without searching: guess, empty\./);
  // Unsearched picks are still marked: one another part's search turned up counts, the rest are memory.
  assert.deepEqual([result.components[0].repo?.found, result.components[3].repo?.found], [['most starred in pdf-parser', 'readme text'], []]);
  assert.deepEqual(result.components[1].dropped, ['acme/gone', '../../evil', 'codeberg.org/../evil']);
  assert.ok(!asked.slice(before).some((call) => call.url.pathname.includes('evil'))); // a bad id is never sent
  // acme/reader is the search's top hit, but another part picked it, so it isn't "not picked"; each forge's top hit
  // comes before any way's second.
  assert.deepEqual(result.components[2].unpicked.map((hit) => hit.id), ['acme/new-hot', 'gitlab.com/lab/reader', 'codeberg.org/berg/tool']);
  assert.match(markdown, /\*\*The search found repos for this job: check them before building one\.\*\*\n- \[acme\/new-hot\]/);
  assert.match(markdown, /No repo left for this: it needs new candidates/);
});

test('searches every way in on each forge, takes the ways in turns, and says which failed', async () => {
  const found = await find([{ id: 'reader', name: 'Read the tables', ...QUERY }]);
  const listed = (forge: string) => [...found.split(`\n${forge}:\n`)[1].split('\n\n')[0].matchAll(/^- (\S+)/gm)].map((match) => match[1]);
  assert.deepEqual(listed('GitHub'), ['acme/reader', 'acme/new-hot', 'acme/popular', 'acme/readme-only']);
  assert.deepEqual(listed('GitLab'), ['gitlab.com/lab/reader']);
  assert.deepEqual(listed('Codeberg'), ['codeberg.org/berg/tool']); // its Go repo isn't in the stack's language
  assert.match(found, /^- acme\/reader {2}· {2}Python {2}· {2}license MIT {2}· {2}12\.0k stars {2}· {2}pushed \d{4}-\d{2}-\d{2} {2}· {2}found: most starred in pdf-parser, name or description has reader, readme text\n {2}> Reads tables out of PDFs$/m);
  assert.match(found, /^- gitlab\.com\/lab\/reader {2}· {2}700 stars {2}· {2}active \d{4}-\d{2}-\d{2} {2}· {2}found: most starred in pdf-parser, name or description has reader \(any language\)\n {2}> Reads tables, on GitLab$/m);
  assert.doesNotMatch(found, /undefined/);

  // What did answer is cached: asking again costs nothing.
  const calls = asked.length;
  await find([{ id: 'reader', name: 'Read the tables', ...QUERY }]);
  assert.equal(asked.length, calls);

  // A stack that can use several languages searches GitHub for repos in any of them; GitLab, which takes one, in all.
  await find([{ id: 'ts', name: 'TS', keywords: ['multi'], language: 'TypeScript, javascript' }]);
  assert.ok(asked.some((call) => call.url.searchParams.get('q') === 'multi in:name,description archived:false language:"typescript" language:"javascript"'));
  assert.ok(asked.some((call) => call.url.host === 'gitlab.com' && call.url.searchParams.get('search') === 'multi' && !call.url.searchParams.has('with_programming_language')));

  // GitHub limited one way: the results say so, and it isn't remembered, so it's asked again.
  const limit = () => find([{ id: 'x', name: 'X', keywords: ['limited'] }]);
  const text = await limit();
  assert.match(text, /Didn't answer: GitHub, name or description has limited\./);
  assert.match(text, /Without a GITHUB_TOKEN, GitHub allows 10 searches a minute/);
  const asks = () => asked.filter((call) => call.url.searchParams.get('q')?.startsWith('limited')).length;
  const before = asks();
  await limit();
  assert.equal(asks(), before + 1);
});

test("from a shell, a search GitHub turns away waits out its limit, once; over MCP it doesn't wait", async () => {
  settings.wait = true;
  limited = 1;
  assert.doesNotMatch(await find([{ id: 'w', name: 'W', keywords: ['patient'] }]), /Didn't answer/);
  settings.wait = false;
  limited = 1;
  assert.match(await find([{ id: 'q', name: 'Q', keywords: ['hasty'] }]), /Didn't answer: GitHub, name or description has hasty\./);
});
