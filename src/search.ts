// The middle step: what the forges have for each part the agent split the need into, found by searching them, not
// recalled. The agent picks from this list; repos it knows that aren't on it may be added, and the report marks them as
// from memory, so what an agent happens to remember never outranks what the search turned up.
import { search, where, type Forge, type Hit, type Query } from './forges.ts';

export interface Wanted extends Query { id: string; name: string }

// How many of each forge's hits a part shows: most of open source is on GitHub, and the rest is its long tail.
const SHOWN: Record<Forge, number> = { GitHub: 15, GitLab: 5, Codeberg: 5 };

const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const line = (hit: Hit) => `- ${[
  hit.id, hit.language, hit.license && `license ${hit.license}`,
  hit.stars !== undefined && `${count(hit.stars)} stars`,
  hit.pushed && `pushed ${hit.pushed.slice(0, 10)}`,
  hit.active && `active ${hit.active.slice(0, 10)}`,
  `found: ${hit.found.join(', ')}`,
].filter(Boolean).join('  ·  ')}${hit.description ? `\n  > ${hit.description}` : ''}`;

export async function find(parts: Wanted[]): Promise<string> {
  const lines = ['# Found just now on GitHub, GitLab and Codeberg', ''];
  let limited = false;
  for (const part of parts) {
    const { hits, failed } = await search(part);
    limited ||= failed.some(({ forge }) => forge === 'GitHub');
    lines.push(`## ${part.name} (${part.id})`, '');
    for (const forge of Object.keys(SHOWN) as Forge[]) {
      const its = hits.filter((hit) => where(hit.id).forge === forge);
      lines.push(`${forge}${its.length > SHOWN[forge] ? ` (${SHOWN[forge]} of ${its.length})` : ''}:`,
        ...(its.length ? its.slice(0, SHOWN[forge]).map(line) : ['- none']), '');
    }
    if (failed.length) lines.push(`Didn't answer: ${failed.map(({ forge, how }) => `${forge}, ${how}`).join('; ')}.`, '');
  }
  if (limited) {
    lines.push("Without a GITHUB_TOKEN, GitHub allows 10 searches a minute (30 with one): wait a minute, then search again for what didn't answer.", '');
  }
  lines.push(`Now give each part its verdict from these results, and pick its candidates from them:
- USE: a repo listed here does the job as it is.  ADAPT: one comes close: fork it or copy what you need, license permitting.  BUILD: none of them does the job, which these results have to show.
- Judge by what the results say (description, stars, recent activity, license, language), not by what you remember. A repo you know that isn't listed may be added; the report will mark it as from memory.
- Name each repo as it's listed here: owner/name on GitHub, and with its host first on GitLab and Codeberg.
- Then call git_for_me_verify, passing each part's search query (topic, language, keywords, phrase) unchanged, or a list of them if you searched a part again, so the report can show what the search turned up.`);
  return lines.join('\n');
}
