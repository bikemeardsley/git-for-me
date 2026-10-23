# Git for Me!

An MCP server: describe what you want to build, and it says which parts open
source already covers, from a live search of GitHub, GitLab and Codeberg:
which repos to use as they are (USE), which to adapt (ADAPT), which parts
nothing covers (BUILD), and which aren't worth a dependency (WRITE), with
every repo checked live. It is the companion of Where My Hug At?
(`P:\windsurf\where-my-hug`, public as bikemeardsley/where-my-hug), which does
the same for Hugging Face models.

**Start with [HANDOFF.md](HANDOFF.md)**: what's built and verified, the
decisions made, the open questions, and the launch plan. Then
[README.md](../README.md).

## Conventions

- **Model it on Where My Hug At?** Same shape, same three-tool flow, same
  report, same release process, same README layout. When unsure how something
  should work here, look at how WMH does it and do the same, with the forges in
  place of Hugging Face. Keep the two in step where they share code: the
  search merge, the verify labels, the server.
- **Search decides, memory only supplements.** Candidates come from a live
  search of GitHub, GitLab and Codeberg (`git_for_me_search`). What an agent
  remembers may be added, but it ranks after the search's picks and the report
  labels it "from memory". Don't add a path where a remembered repo decides
  anything.
- **Three forges, decided 2026-10-14:** GitHub (four ways), GitLab.com and
  Codeberg (topic and keyword). Not gitea.com (a fraction of Codeberg, which
  runs the same software), not Bitbucket (no public search API), not
  GitBucket (self-hosted only). Ids are `owner/name` on GitHub and start with
  the host on the others.
- **Ponytail on, full intensity.** Shortest correct diff; no abstractions,
  config or scaffolding nobody asked for.
- **TypeScript**, Node 22.18+, run straight from source (type stripping) in
  development. `tsc` builds `build/` only on install (`prepare`), because Node
  won't strip types inside `node_modules`, which is where `npx` puts it.
  Dependencies pinned to exact versions, the same as WMH's; never auto-upgrade.
- **One entry point, every client.** `npx -y git-for-me` (the npm package) is
  what the Claude Code plugin, the Gemini extension, other MCP clients and the
  skill's shell fallback all run. It's written in
  `plugin/.claude-plugin/plugin.json`, `plugin/mcp.json` (Agent Plugins, for
  Copilot; beside it `plugin/plugin.json`), `gemini-extension.json`,
  `skills/git-for-me/SKILL.md` (copied to `plugin/skills/`, a test keeps them
  equal), USAGE.md, llms-install.md and the README: change one, change them
  all. The manifests pin the version (`git-for-me@0.1.1`), as Claude's plugin
  directory requires; the README and skill don't. No Cursor plugin (Mike
  passed on Cursor's marketplace for WMH).
- **A release** bumps the version in `package.json`, `src/server.ts`,
  `server.json` (twice), `plugin/.claude-plugin/plugin.json` (`version` and
  the pin), `plugin/plugin.json`, `plugin/mcp.json` (the pin),
  `plugin/mcp_config.json` (the same servers, for Antigravity),
  `gemini-extension.json` and `plugin/package.json` (then
  `npm install --package-lock-only --ignore-scripts` in `plugin/` once the new
  version is on npm, for the directory's launcher lock); then tags `vX.Y.Z`
  and `git-for-me--vX.Y.Z` and a GitHub release from `vX.Y.Z`, which publishes
  to npm and then the MCP Registry (`.github/workflows/release.yml`, OIDC: no
  token, and it refuses a tag that doesn't match every file above but
  `plugin/package.json`, or a commit not in main). npm stages the publish:
  the registry job fails until Mike approves the version on npmjs.com, then
  "Re-run failed jobs" on that run.
- **Codex / ChatGPT plugin directory: likely a dead end, for a while or for
  good.** Tried 2026-10-15. The portal (platform.openai.com/plugins) answered
  "We are not accepting more skills-only submissions at this time", and a
  local `npx` MCP server only gets in through the "desktop-only" path, which
  is for OpenAI-approved partners and uploads through that same closed
  skills-only form. Hosting the server for the remote-MCP route is ruled out.
  Don't spend time on it unless OpenAI reopens skills-only submissions. If it
  does: `git-for-me-codex.zip` (gitignored, repo root) holds
  `.claude-plugin/plugin.json` minus `userConfig` and `mcpServers` (the portal
  refuses both), the icon and `plugin/skills/`; rebuild it first. The listing
  also wants a subtitle of 30 characters or fewer, website, support, privacy
  (PRIVACY.md) and terms (TERMS.md) URLs, and an app icon. Keep the skill
  provider-neutral either way.
- **GitHub Copilot plugin directory: rejected, closed.** Decided 2026-10-15:
  not a fit, since it serves one particular way of working and Copilot can
  already search GitHub itself. There is no way to resubmit; don't try the
  directory again. The self-hosted route (`copilot plugin marketplace add`)
  still works, so `plugin/plugin.json` and `plugin/mcp.json` stay in the
  release checklist for it.
- **Design with the skills, never by hand.** Diagrams with `/diagram-design`,
  under this project's own profile (`git-for-me`, in
  `~/.diagram-design/profiles/`, set by the `.diagram-design` marker), never
  WMH's yellow one. Logo, social card and any page with
  `/design-taste-frontend`. The palette comes from the hermit-crab mascot:
  coral `#ff6f59`, ink `#111`, sea-glass `#eef8f5`. `.github/flow.svg` and
  `flow-dark.svg` are kept in step; after changing them, re-render
  `.github/social-preview.png` from `social-preview.svg` at 1280×640 (it pulls
  in `logo.svg` and `flow.svg`) and upload it under Settings → Social preview.
- **Name:** "Git for Me!" in prose (decided 2026-10-15, matching "Where My
  Hug At?"), "Git for me!" where it's the hook (titles, report heading,
  description openers); `git-for-me` for the package, repo and
  command; `git_for_me` for the tools. Never "GFM", which already means GitHub
  Flavored Markdown. The README says it isn't affiliated with the Git project,
  GitHub, GitLab or Codeberg (Git's trademark policy, checked 2026-10-14).
- **Kitbash is GPL-2.0 and not ours.** Never its code or text, and no credit
  in the README (decided 2026-10-14): the search-first design is our own, and
  only the goal, reuse before building, is shared. It was removed from this
  machine on 2026-10-14 (its folder, skill links, and MCP entries in Claude
  Code and Cline); if it ever comes back, don't read its source while working
  here, so nothing leaks in.
- **American English** in code, docs and commits.
- **General, not tied to any one project.**
- `GITHUB_TOKEN` is read from the environment, sent only to `api.github.com`,
  and never recorded. GitLab and Codeberg are asked without a token.
- Public on bikemeardsley/git-for-me and npm (`git-for-me`, 0.1.0 released
  2026-10-14), MIT. No CONTRIBUTING.md: issues and private security
  advisories only.
- Tests run offline: the forges are mocked.
