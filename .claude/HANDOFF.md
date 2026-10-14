# Handoff: building Git for Me

Written 2026-10-14, at the end of the session that shipped Where My Hug At?
0.2.0 (the search-first version) and stubbed this repo from it. Read this,
then the README, then the code: it's small.

## Where things stand

**Built and verified:**

- The three tools, ported from WMH 0.2.0:
  - [src/rubric.ts](../src/rubric.ts): four questions first (stack, platform,
    license, upkeep), then the six-step method.
  - [src/github.ts](../src/github.ts): the search (four ways, taken in turns,
    cached an hour, failures not cached) and `lookUp` for one repo.
  - [src/search.ts](../src/search.ts): what `git_for_me_search` shows the agent.
  - [src/verify.ts](../src/verify.ts): the live check, flags, "from memory"
    labels, what the search found but nobody picked, `SEARCH_FIRST` and
    `RECALL_REPLACEMENTS`, and the report.
  - [src/server.ts](../src/server.ts): stdio, `--http`, and the shell commands
    (`rubric`, `search`, `verify`).
- Tests: 6 pass offline (`npm test`); types are clean (`npm run check`).
- A live search on 2026-10-14 ("Read the tables": topic `pdf-parser`, language
  `python`, keywords `pdf` and `tables`, phrase "extract tables from pdf")
  found PaddleOCR, MinerU, marker, camelot, surya and excalibur. Quoting the
  README phrase is what made that way precise: unquoted, it returned
  public-apis and other giants that mention every word somewhere.
- README, SECURITY.md, LICENSE (MIT), `.github/FUNDING.yml`, CI
  (`.github/workflows/test.yml`), and the skill
  ([skills/git-for-me/SKILL.md](../skills/git-for-me/SKILL.md)).

**Not built yet:** everything in the build plan below. Nothing is on npm, and
`verify` hasn't been run live end to end with a real agent.

## How it maps from Where My Hug At?

| Where My Hug At? | Git for Me |
|---|---|
| `huggingface.co/api` | `api.github.com` |
| `HF_TOKEN` | `GITHUB_TOKEN` |
| questions: compute, license, stack, data | stack, platform, license, upkeep |
| verdicts: USE, TUNE, TRAIN, WRITE | USE, ADAPT, BUILD, WRITE |
| search: most downloaded, trending, names, card text | most starred in topic, rising in topic, name or description has, readme text |
| models and datasets | repos only |
| sizes against compute: fits, stretch, cloud | nothing yet (open question 1) |
| flags: UNCHECKED, GATED, NO_LICENSE, NON_COMMERCIAL, OWN_TERMS, STALE, LITTLE_USED | UNCHECKED, ARCHIVED, NO_LICENSE, OWN_TERMS, COPYLEFT, STALE, LITTLE_USED, FORK |
| tools `where_my_hug`, `_search`, `_verify` | `git_for_me`, `_search`, `_verify` |

WRITE is decided at the split and never searched, as in WMH. BUILD, like
TRAIN, has to be shown by the search: a BUILD part whose search found repos
says "check them before building one".

## Facts checked live (2026-10-14)

- **Rate limits.** Without a token: search 10 a minute, everything else 60 an
  hour. With one: search 30 a minute, everything else 5,000 an hour.
- **Search qualifiers that work:** `topic:pdf-parser`,
  `created:>2026-04-17`, `archived:false`, `language:"python"`,
  `WORD in:name,description`, `"PHRASE" in:readme`, with `sort=stars`.
- **Search results** carry `full_name`, `description`, `language`,
  `license.spdx_id` (`NOASSERTION` for a license file GitHub can't identify),
  `stargazers_count`, `pushed_at`, `created_at` and `archived`. Forks are left
  out unless the query asks for them.
- **`GET /repos/{owner}/{name}`** answers 404 for a missing repo and for a
  private one the token can't see; follows a rename (it answers with the new
  `full_name`); and gives `parent.full_name` on a fork.
- **GitHub has no trending API.** "Rising" is a topic's repos created in the
  last 182 days, most starred first.

## Decisions made

- **Name:** Git for Me (`git-for-me`), chosen over git-real, where-my-git-at
  and already-git-it. The npm name was free on 2026-10-14. Never "GFM".
- **Verdicts:** USE, ADAPT, BUILD, WRITE: our own words, not Kitbash's.
- **Search decides, memory supplements:** same rule and mechanics as WMH
  0.2.0 (labels, ranking, `SEARCH_FIRST`, "not picked" lists, no memory label
  when a search didn't answer).
- **Kitbash:** no credit anywhere public. WMH dropped its credit the same day.
  Never read its source while working here.
- **Companions:** WMH and Git for Me link each other in their READMEs.
- **Public from day one** (Mike, 2026-10-14), so the repo settings can be set
  early. The README says "pre-release" until launch.

## Open questions (Mike's call)

1. **Fit to the stack.** WMH sizes every model against the compute. The
   GitHub equivalent would flag a repo whose language isn't the stack's
   ("runs beside your code, as a separate tool"). It needs a rule for
   language families: JavaScript and TypeScript, C and C++, and so on.
2. **LITTLE_USED** is under 50 stars: a guess.
3. **Rising window:** 182 days.
4. **Forks in search:** GitHub leaves them out by default. Fine?
5. **Brand:** a logo or mascot, a palette, and the diagram profile.

## Build plan

### Phase 1: make the core solid

1. **Rate limits.** A run spends up to 5 searches a part, so up to 30 for 6
   parts, which is exactly GitHub's limit with a token. In shell mode,
   `verify` runs in a fresh process with no cache and re-runs every search.
   Options: read `x-ratelimit-remaining` and `x-ratelimit-reset` and wait, or
   space the searches. Decide, then test it with the fake GitHub.
2. **Try it end to end with a real agent:**
   `claude mcp add --scope user git-for-me -- node P:\windsurf\git-for-me\src\server.ts`
   (set `GITHUB_TOKEN` in its env), then a few real needs: a CLI, a web-app
   feature, a Python job. Note where the method's wording leads the agent
   astray, and fix the rubric text.
3. **Adversarial review** with the model bench panel
   (`route.py --shape review`), as for WMH 0.2.0, where gemini-3.8-flash and
   inkling-free each found real bugs (one each that the other missed) and
   codestral found none. Verify every finding before acting, and record each
   with `offload.py add`.
4. Settle the open questions.

### Phase 2: design (with the skills, never by hand)

- **`/diagram-design`:** onboard a `git-for-me` profile (never WMH's), add a
  `.diagram-design` marker with `profile: git-for-me`, and draw
  `.github/flow.svg` and `flow-dark.svg` like WMH's: the need with its four
  questions, then "Split into parts" with two labeled exits (A REPO'S JOB to
  the search, JUST CODE down to WRITE), the search's four ways, the verdict,
  and the report; the WRITE lane runs underneath, labeled NO SEARCH. Mike's
  preferences, learned on WMH: each box says what its step does, with no
  worked example; separate functions get separate boxes; straight lines, no
  hand-drawn wobble.
- **`/design-taste-frontend`:** the logo or mascot, and the social card
  (1280×640; WMH's `.github/social-preview.svg` embeds its diagram and is
  rendered to PNG, then uploaded by hand under Settings → Social preview).

### Phase 3: packaging (copy WMH's files and swap the names)

- `package.json`: `mcpName: io.github.bikemeardsley/git-for-me`, version
  0.1.0.
- `server.json` (MCP Registry), `mcp.json` (Cursor), `gemini-extension.json`.
- A `plugin/` folder like WMH's:
  - `.claude-plugin/plugin.json`, with a sensitive `github_token` userConfig
    passed in as `GITHUB_TOKEN`;
  - `plugin.json` and `mcp.json` in the Agent Plugins 1.0.0 format, which
    Copilot needs: WMH's awesome-copilot intake failed until it had them;
  - `package.json` and `package-lock.json`, the launcher lock;
  - a README, an icon, and a copy of the skill, with WMH's test that keeps
    the copies equal.
- `USAGE.md` (setup for 20+ agents; port WMH's) and `llms-install.md` (for
  the Cline marketplace).
- A "release" section in CLAUDE.md listing every file that carries the
  version, like WMH's.

### Phase 4: launch (in WMH's order)

1. `npm publish`. It's staged: Mike approves it on npmjs.com with a one-time
   password, and it shows on npm a few minutes later.
2. Tags `vX.Y.Z` and `git-for-me--vX.Y.Z` (the plugin tag awesome-copilot
   reviews), then a GitHub release with notes.
3. MCP Registry: `mcp-publisher login github`, then `mcp-publisher publish`.
   The binary is `P:\windsurf\thicken-3d-shape-generator\mcp-publisher.exe`,
   and its login expires within hours, so log in right before publishing.
4. Listings, as for WMH: the Claude plugin directory (which then picks up new
   versions by itself), awesome-copilot (an issue form with Ref, SHA and
   Version fields; comment `/rerun-intake` after edits), the Cline
   marketplace (an issue), skills.sh, and the Gemini gallery (automatic, from
   the `gemini-cli-extension` topic plus `gemini-extension.json`).
5. Badges, in WMH's two rows: npm, Tests, MCP Registry, skills.sh, GitHub,
   then TypeScript, Node and license (read from npm once published), Buy Me a
   Coffee and ALS research. Add one per marketplace as each listing goes
   live: flat, one color, linking to the listing.
6. Repo topics for each new route (`claude-code-plugin`,
   `gemini-cli-extension`, `copilot-cli` and so on), as it ships.
7. Drop "pre-release" from the README, and put a live run in it as the
   example, like WMH's recipe-card one.

## Gotchas learned on WMH

- Never build file content in a Bash heredoc (a global rule): use Write and
  Edit.
- In this PowerShell, `Set-Content -NoNewline` failed in one call;
  `[IO.File]::WriteAllText` is reliable.
- `gh` writes to other people's repos (issue edits, comments) can be blocked
  by the permission classifier until Mike clears them.
- The social preview is uploaded by hand, under Settings.
- Mike reads the model panel's makeup as evidence: say which models answered,
  by name and seat, including the ones that missed.
