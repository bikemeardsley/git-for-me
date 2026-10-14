# Handoff: launching Git for Me

Updated 2026-10-14, at the end of the session that built it out from the
stub. Read this, then the README, then the code: it's small.

## Where things stand

**Built and verified (tests: 8 pass offline; types clean):**

- **Three forges.** [src/forges.ts](../src/forges.ts) searches GitHub four
  ways (most starred and rising in the topic, names and descriptions, README
  text) and GitLab.com and Codeberg by topic and keyword, takes the ways in
  turns, and looks up each pick on its own forge. Ids are `owner/name` on
  GitHub and start with the host on the others (a URL works too); a host it
  can't check is dropped with that reason. Decided by Mike: not gitea.com,
  Bitbucket or GitBucket (see CLAUDE.md).
- **Flags** added for the new forges and for what live runs showed:
  UNKNOWN_LICENSE (Codeberg names no licenses: a license file means "read
  it", none means NO_LICENSE), MIRROR, and WEAK_COPYLEFT (LGPL, MPL, EPL,
  CDDL) apart from COPYLEFT.
- **Rate limits.** From a shell (`search`, `verify`), a GitHub search over its
  limit waits for the reset (up to a minute) and asks once more. Over MCP it
  doesn't wait, since clients such as Codex and Cline give up on a call at 60
  seconds; the search says what didn't answer and the agent searches again
  (what answered is cached for an hour).
- **`language`** takes several, comma-separated ("typescript, javascript"):
  GitHub ORs them. GitLab's keyword search runs in any language (filtered by
  one it gives up, a 500 after 15 seconds, on common words).
- **Shell mistakes** are said plainly (no stack traces), and a WRITE part may
  leave out `candidates`.
- **Art**, with `/design-taste-frontend` and `/diagram-design`: the hermit-crab
  mascot (`.github/logo.svg`, `logo-dark.svg`, `logo-400.png`, and
  `plugin/.claude-plugin/icon.png`), the `git-for-me` diagram profile
  (`~/.diagram-design/profiles/git-for-me.md`, selected by `.diagram-design`),
  `.github/flow.svg` and `flow-dark.svg`, and the social card
  (`.github/social-preview.svg`, rendered to `social-preview.png`). The
  generators that drew them were in the session's scratch folder, not kept.
- **Packaging**, ported from WMH: `package.json` at 0.1.0 with `mcpName`,
  `server.json`, `gemini-extension.json`, `.claude-plugin/marketplace.json`,
  `plugin/` (Claude manifest with an optional `github_token`, Agent Plugins
  `plugin.json` and `mcp.json`, launcher `package.json`, README, icon, the
  skill's copy and a test that keeps it equal), USAGE.md, llms-install.md,
  and the release checklist in CLAUDE.md. `npm pack --dry-run`: 8 files.
- **README** opens like WMH's (mascot, badges, blurb, diagram, contents), with
  Mike's blurb ("Odds are, most of what you want to build is already open
  source") and a live run as the example.
- **Installed on this machine:** the user MCP entry `git-for-me` runs
  `node P:\windsurf\git-for-me\src\server.ts` with Mike's public-read-only
  fine-grained `GITHUB_TOKEN` (search limit 30 a minute, checked); the skill is
  linked into `~/.claude/skills` and `~/.agents/skills`. Kitbash's MCP entry
  and skill links were removed (its folder is untouched).

**Live runs** (subagents playing a real agent through the shell route, told
not to read the source), 2026-10-14:

1. "A CLI that pulls the tables out of PDF invoices into a spreadsheet"
   (Python): pdfplumber, OCRmyPDF and XlsxWriter to use, 2 parts to write,
   nothing from memory. It is the README's example. Its notes led to the
   `{ "parts": [...] }` wrapper in the rubric, optional WRITE candidates,
   plain shell errors, WEAK_COPYLEFT, and rationales that mark what's from
   memory.
2. "Typo-tolerant search for the recipes on my Next.js site" (TypeScript):
   Meilisearch or MiniSearch, 3 parts to write. Its notes led to several
   languages per search (TypeScript was hiding JavaScript libraries), and to
   dropping a "search the whole need as one part" line added after run 1: the
   report can't say "either this or those", so an all-in-one read as a second
   requirement.
3. "A nightly job that backs up my Postgres database to S3-compatible storage
   and posts to Slack if it fails" (Go): pg2s3 to use, the Slack post and
   the cron line to write. It searched the backup part three times, and
   because verify then took only a part's last search, it dropped the best fit
   from its first search (jkaninda/pg-bkup) rather than have it labeled from
   memory. Fixed: a part may pass a list of up to 3 searches, and a pick from
   any of them counts as found. Its other notes: one-line descriptions are
   thin evidence for ranking (pg2s3 at 5 stars ahead of onedump at 996), and
   "not picked" showed prometheus/prometheus from a loose keyword.

**Bench review** (`route.py --shape review`): gemini-3.8-flash (primary)
found a real bug, fixed: a URL-form id left unchecked kept its raw name, so
its link doubled the host; also a 200 answer with no repo in it now counts as
unchecked. gemma4-cloud (second) and dots-3-note-preview-free (explorer)
found nothing that held up; north-mini-code-free (explorer) returned nothing
(stream failed). All four recorded with `offload.py add`.

## Facts checked live (2026-10-14)

- **GitHub:** search 10 a minute without a token, 30 with one; everything else
  60 an hour, 5,000 with one. Two `language:` qualifiers are ORed. A 404 for a
  missing repo and for a private one the token can't see; renames are
  followed; `parent.full_name` on a fork. No trending API.
- **GitLab.com** (no token): 500 requests a minute. `/projects` takes
  `topic` (case-sensitive), `search` (name, path, description; substring, so
  "cli" matches "client"), `with_programming_language`, `archived=false` and
  `order_by=star_count`; `created_after` is ignored. Its REST record has the
  license (`?license=true`, keys like `mit`, `gpl-3.0+`, `other`) and
  `forked_from_project`, but not whether it's archived: GraphQL
  (`project(fullPath:) { archived languages }`, over GET) has that. README
  and code search need a login.
- **Codeberg** (Forgejo 16, no token): 2,000 requests per 10 minutes.
  `/repos/search` takes `q` with `topic=true` or `includeDesc=true`,
  `mode=source` (no forks or mirrors), `archived=false`, `sort=stars`. No
  language filter and no license detection; `/repos/{o}/{r}/contents` lists
  the top folder, which shows a license file (`LICENSE-MIT` and `LICENSES/`
  included).
- **gitea.com:** 31.6k public repos (Codeberg: 451k). **Bitbucket:** no
  public search (the global repository listing answers 404).
- Git's trademark policy (git-scm.com/about/trademark) bans "Git" as a
  syllable or portmanteau and implied affiliation; "Git for Me" is neither,
  and the README says it isn't affiliated.

## Open questions

1. **Fit to the stack** (WMH's sizing, for code): a flag for a repo in another
   language than the stack. Run 2 suggests several languages per search covers
   much of it; revisit if live use shows wrong-language picks.
2. **"Not picked" lists** take the first three unpicked hits in turn order,
   which are often noise (run 1: InkDoc, graphify). Ranking them by how many
   ways found each would help, but it's code WMH shares.
3. **Alternatives and conditional parts:** a verdict can't say "either A or
   B" (run 2) or "only if the invoices are scans" (run 1); the rationale has
   to.
4. Thresholds unchanged: LITTLE_USED under 50 stars, rising in 182 days.
5. **For WMH:** it has the same last-search gap run 3 found (a part searched
   again makes its earlier finds "from memory"). Port the list of searches
   per part, since the verify labels are code the two share.

## Launch (in WMH's order)

**Done, 2026-10-14:** pushed; npm `git-for-me@0.1.0` (Mike ran `npm publish`:
from a shell without a terminal, npm's one-time-password sign-in can't open,
so he runs it himself); the plugin's launcher lock; tags `v0.1.0` and
`git-for-me--v0.1.0` at `2bdac23` and the
[v0.1.0 release](https://github.com/bikemeardsley/git-for-me/releases/tag/v0.1.0);
the MCP Registry, `io.github.bikemeardsley/git-for-me` 0.1.0, active (Mike
authorized `mcp-publisher login github` by device code, then it published);
skills.sh (installed once into a scratch folder); the social preview (Mike);
badges for npm, the MCP Registry and skills.sh, and "pre-release" dropped.

**Left** (Mike's steps marked **(Mike)**):

5. Listings:
   - **(Mike)** the Claude plugin directory.
   - awesome-copilot: an issue form like WMH's #5061 (plugin path `plugin`,
     ref `refs/tags/git-for-me--v0.1.0`, SHA
     `2bdac23293f78745abb6f25ac39e90da9e736e9c`, version 0.1.0, MIT; comment
     `/rerun-intake` after edits).
   - Cline marketplace: an issue like WMH's #2979 (repo URL, logo
     `https://raw.githubusercontent.com/bikemeardsley/git-for-me/main/.github/logo-400.png`,
     both checkboxes, and a paragraph on what it does).
   - Gemini gallery: automatic from the `gemini-cli-extension` topic plus
     `gemini-extension.json`.
6. A badge per marketplace as each goes live (flat, one color, linking to the
   listing). Repo topics for each route (`claude-code-plugin`,
   `gemini-cli-extension`, `copilot-cli`, plus `gitlab` and `codeberg`), and
   the repo description to match the blurb.
9. WMH's README calls Git for Me "the same for GitHub repos": change it to
   GitHub, GitLab and Codeberg. And fix WMH's USAGE.md token command: in
   `claude mcp add`, `-e` takes every value after it, so the server name must
   come before `-e` (`... where-my-hug -e HF_TOKEN=hf_... -- npx ...`), as
   Git for Me's USAGE.md now has it.
10. The website brief: `michaelbeardsley-now/docs/git-for-me.md` and queue
    item 9 in its NEXT.md, in the shape of `docs/thicken.md`: URL
    `/projects/git-for-me/`, featured third (`order: 3`, after Where My Hug
    At? and thicken), art from `.github/`, links to source, npm, the release,
    skills.sh and the MCP Registry. Leave it uncommitted there, as the other
    briefs are. When the page is live, set the repo's Website field to
    `https://michaelbeardsley.now/projects/git-for-me/`.

## Gotchas

- Never build file content in a Bash heredoc (a global rule): use Write and
  Edit.
- The `claude` on PATH here is a broken npm shim; the working CLI is the VS
  Code extension's (`~/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude.exe`).
- `gh` writes to other people's repos (issue edits, comments) can be blocked
  by the permission classifier until Mike clears them.
- The `llm` CLI can fail mid-answer on Windows with a charmap error (it did
  for dots-3-note-preview-free): its output is cut off.
- Mike reads the model panel's makeup as evidence: say which models answered,
  by name and seat, including the ones that missed.
