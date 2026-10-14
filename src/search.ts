// The middle step: what GitHub has for each part the agent split the need into, found by searching it, not recalled.
// The agent picks from this list; repos it knows that aren't on it may be added, and the report marks them as from
// memory, so what an agent happens to remember never outranks what GitHub turned up.
import { search, type Hit, type Query } from './github.ts';

export interface Wanted extends Query { id: string; name: string }

const REPOS = 15;

const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const line = (hit: Hit) => `- ${[
  hit.id, hit.language, hit.license && `license ${hit.license}`,
  hit.stars !== undefined && `${count(hit.stars)} stars`,
  hit.pushed && `pushed ${hit.pushed.slice(0, 10)}`,
  `found: ${hit.found.join(', ')}`,
].filter(Boolean).join('  ·  ')}${hit.description ? `\n  > ${hit.description}` : ''}`;

export async function find(parts: Wanted[]): Promise<string> {
  const lines = ['# Found on GitHub just now', ''];
  let failures = 0;
  for (const part of parts) {
    const { hits, failed } = await search(part);
    failures += failed.length;
    lines.push(
      `## ${part.name} (${part.id})`, '',
      `Repos${hits.length > REPOS ? ` (${REPOS} of ${hits.length})` : ''}:`,
      ...(hits.length ? hits.slice(0, REPOS).map(line) : ['- none']), '',
      ...(failed.length ? [`GitHub didn't answer: ${failed.join('; ')}.`, ''] : []),
    );
  }
  if (failures) {
    lines.push("Without a GITHUB_TOKEN, GitHub allows 10 searches a minute (30 with one): wait a minute, then search again for what didn't answer.", '');
  }
  lines.push(`Now give each part its verdict from these results, and pick its candidates from them:
- USE: a repo listed here does the job as it is.  ADAPT: one comes close: fork it or copy what you need, license permitting.  BUILD: none of them does the job, which these results have to show.
- Judge by what the results say (description, stars, recent pushes, license, language), not by what you remember. A repo you know that isn't listed may be added; the report will mark it as from memory.
- Then call git_for_me_verify, passing each part's search query (topic, language, keywords, phrase) unchanged, so the report can show what the search turned up.`);
  return lines.join('\n');
}
