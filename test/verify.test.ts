import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Query } from '../src/github.ts';
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
};
// Its search, by query, the rising cutoff date aside. A query not here finds nothing.
const SEARCH: Record<string, object[]> = {
  'topic:pdf-parser archived:false language:"python"': [REPOS['acme/reader'], { full_name: 'acme/popular', stargazers_count: 50_000, language: 'Python', license: { spdx_id: 'Apache-2.0' } }],
  'topic:pdf-parser created:>DATE archived:false language:"python"': [{ full_name: 'acme/new-hot', stargazers_count: 400, created_at: now }],
  'reader in:name,description archived:false language:"python"': [REPOS['acme/reader'], { stargazers_count: 5 }], // an item with no name is no hit
  '"tables" in:readme archived:false language:"python"': [{ full_name: 'Acme/Reader' }, { full_name: 'acme/readme-only', stargazers_count: 30 }], // acme/reader, spelled another way
};
const asked: { path: string; q: string | null; authorization: string | null }[] = [];
let flaky = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const q = url.searchParams.get('q');
  asked.push({ path: url.pathname, q, authorization: new Headers(init?.headers).get('authorization') });
  if (url.pathname === '/search/repositories') {
    if (q?.startsWith('limited')) return new Response('API rate limit exceeded', { status: 403 });
    return Response.json({ items: SEARCH[(q ?? '').replace(/created:>\d{4}-\d{2}-\d{2}/, 'created:>DATE')] ?? [] });
  }
  const id = url.pathname.replace('/repos/', '');
  if (id === 'acme/flaky' && !flaky++) throw new TypeError('fetch failed');
  return REPOS[id] ? Response.json(REPOS[id]) : new Response('Not Found', { status: 404 });
};

const QUERY: Query = { topic: 'PDF Parser', language: 'python', keywords: ['reader'], phrase: 'tables' }; // the topic as an agent might write it
const part = (id: string, verdict: 'USE' | 'ADAPT' | 'BUILD' | 'WRITE', candidates: string[],
  search: Query | undefined = verdict === 'WRITE' ? undefined : { keywords: [id] }) =>
  ({ id, name: id, role: `${id}'s job`, verdict, rationale: `why ${id}`, candidates: candidates.map((candidate) => ({ id: candidate })), search });

test("puts the search's picks first, drops what isn't there and flags what bites", async () => {
  process.env.GITHUB_TOKEN = 'ghp_secret_test_token';
  const { markdown, result } = await verify({
    need: 'pull tables out of PDFs',
    components: [
      part('reader', 'USE', ['acme/made-up', 'acme/old', 'acme/reader', 'acme/gpl'], QUERY),
      part('odds', 'ADAPT', ['acme/odd', 'acme/fork', 'acme/renamed']),
      part('flaky', 'USE', ['acme/flaky']),
      part('glue', 'WRITE', []),
    ],
  });
  delete process.env.GITHUB_TOKEN;
  const [reader, odds, flaky, glue] = result.components;

  // The search's pick heads the part, though named after two it didn't turn up; those follow, from memory.
  assert.deepEqual([reader.repo?.id, reader.repo?.found], ['acme/reader', ['most starred in pdf-parser', 'name or description has reader', 'readme text']]);
  assert.deepEqual(reader.alternates.map((entry) => [entry.id, entry.flags, entry.found]),
    [['acme/old', ['ARCHIVED', 'NO_LICENSE', 'STALE', 'LITTLE_USED'], []], ['acme/gpl', ['COPYLEFT'], []]]);
  assert.deepEqual(reader.dropped, ['acme/made-up']);
  assert.deepEqual(reader.unpicked.map((hit) => hit.id), ['acme/new-hot', 'acme/popular', 'acme/readme-only']); // in turns, one way after another

  assert.deepEqual([odds.repo?.id, odds.repo?.flags], ['acme/odd', ['OWN_TERMS']]);
  assert.deepEqual(odds.alternates.map((entry) => [entry.id, entry.flags, entry.forkOf]), [['acme/fork', ['FORK'], 'upstream/fork'], ['acme/new-name', [], undefined]]);
  assert.deepEqual(flaky.repo?.flags, ['UNCHECKED']); // kept: GitHub didn't say it's missing
  assert.deepEqual([reader, odds, flaky, glue].map((p) => p.missing), [false, false, false, false]);
  assert.equal(result.nextAction, 'DONE');

  assert.match(markdown, /\*\*Repo: \[acme\/reader\]\(https:\/\/github\.com\/acme\/reader\)\*\*\n_Reads tables out of PDFs_\nPython {2}· {2}license MIT {2}· {2}12\.0k stars {2}· {2}pushed today {2}· {2}found: most starred in pdf-parser, name or description has reader, readme text\n/);
  assert.match(markdown, /\*\*Repo: \[acme\/odd\]\(https:\/\/github\.com\/acme\/odd\)\*\* _from memory: the search didn't turn it up_/);
  assert.match(markdown, /Also: \[acme\/old\]\(https:\/\/github\.com\/acme\/old\) \(archived, no license, stale, little used, from memory\) {2}· {2}\[acme\/gpl\]\(https:\/\/github\.com\/acme\/gpl\) \(copyleft, from memory\)/);
  assert.match(markdown, /8 named, 6 from memory rather than the search, 1 not there and dropped, 1 GitHub didn't answer for/);
  assert.match(markdown, /The search also found, not picked:\n- \[acme\/new-hot\]\(https:\/\/github\.com\/acme\/new-hot\) \(400 stars\): found as rising in pdf-parser\n/);
  assert.match(markdown, /No repo: write this one/);

  // The token goes to GitHub, and nowhere else: not into the report or the JSON.
  assert.ok(asked.every((call) => call.authorization === 'Bearer ghp_secret_test_token'));
  assert.doesNotMatch(markdown + JSON.stringify(result), /ghp_secret/);
});

test('sends the agent to search first, back for parts left with nothing, and a BUILD verdict shows what the search found', async () => {
  const before = asked.length;
  const { result, markdown } = await verify({
    need: 'pull tables out of PDFs',
    components: [
      { ...part('guess', 'USE', ['acme/reader']), search: undefined },
      part('gone', 'USE', ['acme/gone', '../../evil']),
      part('maker', 'BUILD', [], { topic: 'pdf-parser', language: 'python' }),
      part('empty', 'ADAPT', ['acme/gpl'], {}), // a search for nothing is no search
    ],
  });
  assert.equal(result.nextAction, 'SEARCH_FIRST');
  assert.deepEqual(result.components.map((p) => [p.unsearched, p.missing]), [[true, false], [false, true], [false, false], [true, false]]);
  assert.match(result.instructions, /picked without searching: guess, empty\./);
  // Unsearched picks are still marked: one another part's search turned up counts, the rest are memory.
  assert.deepEqual([result.components[0].repo?.found, result.components[3].repo?.found], [['most starred in pdf-parser'], []]);
  assert.deepEqual(result.components[1].dropped, ['acme/gone', '../../evil']);
  assert.ok(!asked.slice(before).some((call) => call.path.includes('evil'))); // a bad id is never sent
  // acme/reader is the search's top hit, but another part picked it, so it isn't "not picked".
  assert.deepEqual(result.components[2].unpicked.map((hit) => hit.id), ['acme/new-hot', 'acme/popular']);
  assert.match(markdown, /\*\*The search found repos for this job: check them before building one\.\*\*\n- \[acme\/new-hot\]/);
  assert.match(markdown, /No repo on GitHub for this yet: it needs new candidates/);
});

test('searches every way in, takes the ways in turns, and says which failed', async () => {
  const found = await find([{ id: 'reader', name: 'Read the tables', ...QUERY }]);
  assert.deepEqual([...found.matchAll(/^- ([\w-]+\/[\w-]+)/gm)].map((match) => match[1]), ['acme/reader', 'acme/new-hot', 'acme/popular', 'acme/readme-only']);
  assert.match(found, /^- acme\/reader {2}· {2}Python {2}· {2}license MIT {2}· {2}12\.0k stars {2}· {2}pushed \d{4}-\d{2}-\d{2} {2}· {2}found: most starred in pdf-parser, name or description has reader, readme text\n {2}> Reads tables out of PDFs$/m);
  assert.doesNotMatch(found, /undefined/);

  // What did answer is cached: asking again costs nothing.
  const calls = asked.length;
  await find([{ id: 'reader', name: 'Read the tables', ...QUERY }]);
  assert.equal(asked.length, calls);

  // GitHub limited one way: the results say so, and it isn't remembered, so it's asked again.
  const limited = () => find([{ id: 'x', name: 'X', keywords: ['limited'] }]);
  const text = await limited();
  assert.match(text, /GitHub didn't answer: name or description has limited\./);
  assert.match(text, /Without a GITHUB_TOKEN, GitHub allows 10 searches a minute/);
  const asks = () => asked.filter((call) => call.q?.startsWith('limited')).length;
  const before = asks();
  await limited();
  assert.equal(asks(), before + 1);
});
