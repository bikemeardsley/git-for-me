// The last step: every repo the agent picked is looked up on its forge. One that isn't there is dropped; the rest are
// flagged for what would bite later (no license, copyleft, archived, years without a push, almost no use, a fork).
// Each part's search is run again (from the cache, mostly), so the report knows what the search turned up: a pick the
// search found outranks one the agent only remembered, and what the search found but the agent didn't pick is shown,
// so nothing it turned up is hidden.
import { lookUp, search, where, type Entry, type Hit, type Query } from './forges.ts';

export type Verdict = 'USE' | 'ADAPT' | 'BUILD' | 'WRITE';
export interface Candidate { id: string }
export interface Component { id: string; name: string; role: string; verdict: Verdict; rationale: string; candidates: Candidate[]; search?: Query | Query[] }
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
const WEAK_COPYLEFT = /LGPL|MPL|EPL|CDDL/i; // binds changes to it, not the code using it
const COPYLEFT = /GPL|EUPL|OSL|CC-BY-SA|SSPL|CECILL/i; // the GPL family, AGPL among it, and its kin
const memoryLast = (a: Checked, b: Checked) => Number(a.found?.length === 0) - Number(b.found?.length === 0);

export async function verify({ need, components }: { need: string; components: Component[] }) {
  // A part's searches: one, or each it had if it was searched again with other words. {} searches nothing.
  const queriesOf = ({ search: given }: Component) => [given ?? []].flat().filter((query) => query.topic || query.keywords?.length || query.phrase);
  const searches = await Promise.all(components.map(async (component) => {
    const results = await Promise.all(queriesOf(component).map((query) => search(query)));
    if (!results.length) return undefined;
    const hits = new Map<string, Hit>();
    for (const hit of results.flatMap((result) => result.hits)) {
      const seen = hits.get(hit.id.toLowerCase());
      if (seen) seen.found = [...new Set([...seen.found, ...hit.found])];
      else hits.set(hit.id.toLowerCase(), { ...hit, found: [...hit.found] });
    }
    return { hits: [...hits.values()], failed: results.flatMap((result) => result.failed) };
  }));
  // A search that didn't answer may have held any pick: then none can be called memory.
  const unanswered = searches.reduce((sum, result) => sum + (result?.failed.length ?? 0), 0);
  // Found by any part's search counts as found; and what any part picked isn't "not picked" in another.
  const how = new Map<string, string[]>();
  for (const hit of searches.flatMap((result) => result?.hits ?? [])) {
    how.set(hit.id.toLowerCase(), [...new Set([...(how.get(hit.id.toLowerCase()) ?? []), ...hit.found])]);
  }
  const looked = await Promise.all(components.map(({ candidates }) => Promise.all(candidates.map(({ id }) => lookUp(id)))));
  // By the name it was given and the one its forge answered with (a rename, a URL, another case).
  const picked = new Set([...components.flatMap(({ candidates }) => candidates), ...looked.flat()].map(({ id }) => id.toLowerCase()));
  const parts: Part[] = components.map((component, i) => {
    const entries = looked[i];
    const found: Checked[] = entries.filter((entry, at, all) => entry.exists !== false &&
      all.findIndex((other) => other.id.toLowerCase() === entry.id.toLowerCase()) === at).map((entry) => ({ // Repo and repo are one
      ...entry, flags: flagsOf(entry), found: how.get(entry.id.toLowerCase()) ?? (unanswered ? undefined : []),
    })).sort(memoryLast);
    return {
      ...component,
      repo: found[0],
      alternates: found.slice(1),
      dropped: entries.filter((entry) => entry.exists === false).map((entry) => entry.id),
      missing: !found.length && (component.verdict === 'USE' || component.verdict === 'ADAPT'),
      unpicked: component.verdict === 'WRITE' ? [] : (searches[i]?.hits ?? []).filter((hit) => !picked.has(hit.id.toLowerCase())).slice(0, UNPICKED),
      unsearched: component.verdict !== 'WRITE' && !searches[i],
    };
  });
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
        : "Show the user the markdown report as it is. Its facts came from the forges just now; don't restate them from memory.",
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
  else if (entry.license === 'unknown') flags.push('UNKNOWN_LICENSE');
  else if (entry.license && WEAK_COPYLEFT.test(entry.license)) flags.push('WEAK_COPYLEFT');
  else if (entry.license && COPYLEFT.test(entry.license)) flags.push('COPYLEFT');
  const last = entry.pushed ?? entry.active; // activity is never older than the last push, so it can only miss STALE
  if (last && Date.now() - Date.parse(last) > STALE_DAYS * 864e5) flags.push('STALE');
  if (entry.stars !== undefined && entry.stars < LITTLE_USED) flags.push('LITTLE_USED');
  if (entry.forkOf) flags.push('FORK');
  if (entry.mirrorOf) flags.push('MIRROR');
  return flags;
}

const FLAG_WORDS: Record<string, string> = {
  UNCHECKED: "its forge didn't answer, so it's unchecked",
  ARCHIVED: 'archived: read-only, so every fix is yours',
  NO_LICENSE: 'no license: all rights reserved, so its code may not be reused',
  OWN_TERMS: "a license its forge can't identify: read it",
  UNKNOWN_LICENSE: "Codeberg doesn't say which license it has: read it before reusing the code",
  COPYLEFT: 'copyleft: shipping it with your code can bind your code to its license',
  WEAK_COPYLEFT: "weak copyleft: changes to it must be shared under its license, but using it unchanged usually doesn't bind your code",
  STALE: 'no pushes in two years',
  LITTLE_USED: `under ${LITTLE_USED} stars: little used`,
  FORK: 'a fork: check whether the original is the better pick',
  MIRROR: 'a mirror: pick the original it copies',
};

const url = (id: string) => (where(id).forge === 'GitHub' ? `https://github.com/${id}` : `https://${id}`);
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
    entry.active && `active ${age(entry.active)}`,
    entry.forkOf && `forked from ${entry.forkOf}`,
    entry.mirrorOf && `mirror of ${entry.mirrorOf}`,
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
  const elsewhere = parts.reduce((sum, part) => sum + part.dropped.filter((id) => !where(id).forge).length, 0);
  const dropped = parts.reduce((sum, part) => sum + part.dropped.length, 0) - elsewhere;
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
    `_Searched and checked live just now: ${named} named${remembered ? `, ${remembered} from memory rather than the search` : ''}, ${dropped} not there and dropped${elsewhere ? `, ${elsewhere} on a forge it can't check` : ''}${unchecked ? `, ${unchecked} left unchecked as ${unchecked === 1 ? 'its forge' : 'their forges'} didn't answer` : ''}${unanswered ? `; ${unanswered} ${unanswered === 1 ? 'search' : 'searches'} didn't answer, so no pick is marked from memory` : ''}._`,
  ];
  for (const part of parts) {
    lines.push('', '---', '', `## ${part.verdict}  ·  ${part.name}`, '', `_${part.role}_`, '');
    if (part.repo) lines.push(...pick(part.repo));
    if (part.missing) lines.push('**No repo left for this: it needs new candidates.**', '');
    else if (part.verdict === 'WRITE' && !part.repo) lines.push('**No repo: write this one.**', '');
    else if (part.verdict === 'BUILD' && !part.repo) lines.push('**Nothing the search found does this: build it.**', '');
    lines.push(part.rationale);
    if (part.alternates.length) lines.push('', `Also: ${part.alternates.map((entry) => `[${entry.id}](${url(entry.id)})${brief(entry)}`).join('  ·  ')}`);
    if (part.unpicked.length) {
      lines.push('', part.verdict === 'BUILD' ? '**The search found repos for this job: check them before building one.**' : 'The search also found, not picked:',
        ...part.unpicked.map((hit) => `- [${hit.id}](${url(hit.id)})${hit.stars !== undefined ? ` (${count(hit.stars)} stars)` : ''}: found as ${hit.found.join(', ')}`));
    }
    const elsewhere = part.dropped.filter((id) => !where(id).forge);
    const gone = part.dropped.filter((id) => where(id).forge);
    if (gone.length) lines.push('', `Dropped, not found (or private): ${gone.join(', ')}`);
    if (elsewhere.length) lines.push('', `Dropped, on a forge it can't check (only GitHub, GitLab.com and Codeberg): ${elsewhere.join(', ')}`);
  }
  const width = Math.max(...parts.map((part) => part.name.length));
  lines.push('', '---', '', '## At a glance', '', '```', ...parts.map((part, i) =>
    `${i + 1}. ${part.name.padEnd(width)}  ${part.verdict.padEnd(5)}  ${part.repo?.id ?? (part.verdict === 'WRITE' ? 'your code' : part.verdict === 'BUILD' ? 'build it' : '(nothing left)')}`), '```');
  return lines.join('\n');
}
