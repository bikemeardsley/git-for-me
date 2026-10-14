// The last step: every repo the agent picked is looked up on GitHub. One that isn't there is dropped; the rest are
// flagged for what would bite later (no license, copyleft, archived, years without a push, almost no use, a fork).
// Each part's search is run again (from the cache, mostly), so the report knows what GitHub turned up: a pick the
// search found outranks one the agent only remembered, and what the search found but the agent didn't pick is shown,
// so nothing it turned up is hidden.
import { lookUp, search, type Entry, type Hit, type Query } from './github.ts';

export type Verdict = 'USE' | 'ADAPT' | 'BUILD' | 'WRITE';
export interface Candidate { id: string }
export interface Component { id: string; name: string; role: string; verdict: Verdict; rationale: string; candidates: Candidate[]; search?: Query }
type Checked = Entry & { flags: string[]; found?: string[] }; // found: how the search turned it up; [] from memory only
interface Part extends Component {
  repo?: Checked; // the first pick still standing: the search's before any from memory
  alternates: Checked[];
  dropped: string[];
  missing: boolean; // a USE or ADAPT part with no repo left: it needs new candidates
  unpicked: Hit[]; // repos the search found that weren't picked
  unsearched: boolean; // a part that needs a repo, picked without searching
}

const UNPICKED = 3;
const STALE_DAYS = 730;
const LITTLE_USED = 50; // stars
const COPYLEFT = /GPL|MPL|EPL|EUPL|OSL|CC-BY-SA|SSPL|CECILL/i; // the GPL family, LGPL and AGPL among it, and its kin
const memoryLast = (a: Checked, b: Checked) => Number(a.found?.length === 0) - Number(b.found?.length === 0);

export async function verify({ need, components }: { need: string; components: Component[] }) {
  const queryOf = ({ search: query }: Component) => (query?.topic || query?.keywords?.length || query?.phrase ? query : undefined); // {} searches nothing
  const searches = await Promise.all(components.map((component) => {
    const query = queryOf(component);
    return query ? search(query) : undefined;
  }));
  // A search that didn't answer may have held any pick: then none can be called memory.
  const unanswered = searches.reduce((sum, result) => sum + (result?.failed.length ?? 0), 0);
  // Found by any part's search counts as found; and what any part picked isn't "not picked" in another.
  const how = new Map<string, string[]>();
  for (const hit of searches.flatMap((result) => result?.hits ?? [])) {
    how.set(hit.id.toLowerCase(), [...new Set([...(how.get(hit.id.toLowerCase()) ?? []), ...hit.found])]);
  }
  const picked = new Set(components.flatMap(({ candidates }) => candidates.map(({ id }) => id.toLowerCase())));
  const parts: Part[] = await Promise.all(components.map(async (component, i) => {
    const entries = await Promise.all(component.candidates.map(({ id }) => lookUp(id)));
    const query = queryOf(component);
    const found: Checked[] = entries.filter((entry, at, all) => entry.exists !== false &&
      all.findIndex((other) => other.id.toLowerCase() === entry.id.toLowerCase()) === at).map((entry) => ({ // Repo and repo are one
      ...entry, flags: flagsOf(entry), found: how.get(entry.id.toLowerCase()) ?? (unanswered ? undefined : []),
    })).sort(memoryLast);
    const named = new Set([...picked, ...found.map((entry) => entry.id.toLowerCase())]); // and GitHub's spelling of each
    return {
      ...component,
      repo: found[0],
      alternates: found.slice(1),
      dropped: entries.filter((entry) => entry.exists === false).map((entry) => entry.id),
      missing: !found.length && (component.verdict === 'USE' || component.verdict === 'ADAPT'),
      unpicked: component.verdict === 'WRITE' ? [] : (searches[i]?.hits ?? []).filter((hit) => !named.has(hit.id.toLowerCase())).slice(0, UNPICKED),
      unsearched: component.verdict !== 'WRITE' && !query,
    };
  }));
  const unsearched = parts.filter((part) => part.unsearched).map((part) => part.id);
  const recall = parts.filter((part) => part.missing).map((part) => part.id);
  const result = {
    need,
    components: parts,
    nextAction: unsearched.length ? 'SEARCH_FIRST' : recall.length ? 'RECALL_REPLACEMENTS' : 'DONE',
    instructions: unsearched.length
      ? `These parts were picked without searching: ${unsearched.join(', ')}. Call git_for_me_search for them, pick their candidates from what it finds, then call git_for_me_verify again with the whole slate and each part's search query.`
      : recall.length
        ? `These parts need new repos: ${recall.join(', ')}. Pick them from git_for_me_search's results (not the dropped ones again; search again with other words if those ran out), then call git_for_me_verify again with the whole slate.`
        : "Show the user the markdown report as it is. Its facts came from GitHub just now; don't restate them from memory.",
  };
  return { markdown: report(need, parts, unanswered), result };
}

/** What would bite later, in GitHub's own facts. */
function flagsOf(entry: Entry): string[] {
  const flags: string[] = [];
  if (entry.exists === undefined) flags.push('UNCHECKED');
  if (entry.archived) flags.push('ARCHIVED');
  if (entry.exists && !entry.license) flags.push('NO_LICENSE');
  else if (entry.license === 'other') flags.push('OWN_TERMS');
  else if (entry.license && COPYLEFT.test(entry.license)) flags.push('COPYLEFT');
  if (entry.pushed && Date.now() - Date.parse(entry.pushed) > STALE_DAYS * 864e5) flags.push('STALE');
  if (entry.stars !== undefined && entry.stars < LITTLE_USED) flags.push('LITTLE_USED');
  if (entry.forkOf) flags.push('FORK');
  return flags;
}

const FLAG_WORDS: Record<string, string> = {
  UNCHECKED: "GitHub didn't answer, so it's unchecked",
  ARCHIVED: 'archived: read-only, so every fix is yours',
  NO_LICENSE: 'no license: all rights reserved, so its code may not be reused',
  OWN_TERMS: "a license GitHub can't identify: read it",
  COPYLEFT: 'copyleft: using or changing it can bind your code to its license',
  STALE: 'no pushes in two years',
  LITTLE_USED: `under ${LITTLE_USED} stars: little used`,
  FORK: 'a fork: check whether the original is the better pick',
};

const url = (id: string) => `https://github.com/${id}`;
const count = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const brief = ({ flags, found }: Checked) => {
  const notes = [...flags.map((flag) => flag.toLowerCase().replace('_', ' ')), ...(found?.length === 0 ? ['from memory'] : [])];
  return notes.length ? ` (${notes.join(', ')})` : '';
};
const age = (iso: string) => {
  const days = Math.round((Date.now() - Date.parse(iso)) / 864e5);
  return days < 1 ? 'today' : days < 60 ? `${days} days ago` : days < 730 ? `${Math.round(days / 30)} months ago` : `${Math.round(days / 365)} years ago`;
};

/** A pick in full: its link and what it is, then GitHub's facts about it, then what to watch. */
function pick(entry: Checked): string[] {
  const facts = [
    entry.language, entry.license && `license ${entry.license}`,
    entry.stars !== undefined && `${count(entry.stars)} stars`,
    entry.pushed && `pushed ${age(entry.pushed)}`,
    entry.forkOf && `forked from ${entry.forkOf}`,
    entry.found?.length && `found: ${entry.found.join(', ')}`,
  ].filter(Boolean).join('  ·  ');
  return [
    `**Repo: [${entry.id}](${url(entry.id)})**${entry.found?.length === 0 ? " _from memory: the search didn't turn it up_" : ''}`,
    ...(entry.description ? [`_${entry.description}_`] : []),
    facts,
    ...(entry.flags.length ? ['', `Watch out: ${entry.flags.map((flag) => FLAG_WORDS[flag]).join('; ')}.`] : []),
    '',
  ];
}

function report(need: string, parts: Part[], unanswered: number): string {
  const named = parts.reduce((sum, part) => sum + part.candidates.length, 0);
  const dropped = parts.reduce((sum, part) => sum + part.dropped.length, 0);
  const kept = parts.flatMap((part) => [part.repo, ...part.alternates]);
  const unchecked = kept.filter((entry) => entry?.flags.includes('UNCHECKED')).length;
  const remembered = kept.filter((entry) => entry?.found?.length === 0).length;
  const tally = (['USE', 'ADAPT', 'BUILD', 'WRITE'] as const)
    .map((verdict) => [parts.filter((part) => part.verdict === verdict).length, { USE: 'to use as is', ADAPT: 'to adapt', BUILD: 'to build', WRITE: 'to write' }[verdict]] as const)
    .filter(([n]) => n).map(([n, words]) => `${n} ${words}`);
  const lines = [
    '# Git for me', '',
    `**${need}**`, '',
    `${parts.length} ${parts.length === 1 ? 'part' : 'parts'}: ${tally.join(', ')}.`, '',
    `_Searched and checked on GitHub just now: ${named} named${remembered ? `, ${remembered} from memory rather than the search` : ''}, ${dropped} not there and dropped${unchecked ? `, ${unchecked} GitHub didn't answer for` : ''}${unanswered ? `; ${unanswered} ${unanswered === 1 ? 'search' : 'searches'} didn't answer, so no pick is marked from memory` : ''}._`,
  ];
  for (const part of parts) {
    lines.push('', '---', '', `## ${part.verdict}  ·  ${part.name}`, '', `_${part.role}_`, '');
    if (part.repo) lines.push(...pick(part.repo));
    if (part.missing) lines.push('**No repo on GitHub for this yet: it needs new candidates.**', '');
    else if (part.verdict === 'WRITE' && !part.repo) lines.push('**No repo: write this one.**', '');
    else if (part.verdict === 'BUILD' && !part.repo) lines.push('**Nothing on GitHub does this: build it.**', '');
    lines.push(part.rationale);
    if (part.alternates.length) lines.push('', `Also: ${part.alternates.map((entry) => `[${entry.id}](${url(entry.id)})${brief(entry)}`).join('  ·  ')}`);
    if (part.unpicked.length) {
      lines.push('', part.verdict === 'BUILD' ? '**The search found repos for this job: check them before building one.**' : 'The search also found, not picked:',
        ...part.unpicked.map((hit) => `- [${hit.id}](${url(hit.id)})${hit.stars !== undefined ? ` (${count(hit.stars)} stars)` : ''}: found as ${hit.found.join(', ')}`));
    }
    if (part.dropped.length) lines.push('', `Dropped, not on GitHub (or private): ${part.dropped.join(', ')}`);
  }
  const width = Math.max(...parts.map((part) => part.name.length));
  lines.push('', '---', '', '## At a glance', '', '```', ...parts.map((part, i) =>
    `${i + 1}. ${part.name.padEnd(width)}  ${part.verdict.padEnd(5)}  ${part.repo?.id ?? (part.verdict === 'WRITE' ? 'your code' : part.verdict === 'BUILD' ? 'build it' : '(nothing left)')}`), '```');
  return lines.join('\n');
}
