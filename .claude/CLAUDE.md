# Git for Me

An MCP server: describe what you want to build, and it says which parts GitHub
already covers (USE), which to adapt from an existing repo (ADAPT), which to
build because nothing fits (BUILD), and which are just code (WRITE), with every
repo found by a live search of GitHub and checked live. It is the companion of
Where My Hug At? (`P:\windsurf\where-my-hug`, public as
bikemeardsley/where-my-hug), which does the same for Hugging Face models.

**Start with [HANDOFF.md](HANDOFF.md)**: what's built and verified, the
decisions made, the open questions, and the build and launch plan. Then
[README.md](../README.md).

## Conventions

- **Model it on Where My Hug At?** Same shape, same three-tool flow, same
  report, same release process, same README layout. When unsure how something
  should work here, look at how WMH does it and do the same, with GitHub in
  place of Hugging Face. Keep the two in step where they share code: the
  search merge, the verify labels, the server.
- **Search decides, memory only supplements.** Candidates come from a live
  search of GitHub (`git_for_me_search`). What an agent remembers may be
  added, but it ranks after the search's picks and the report labels it "from
  memory". Don't add a path where a remembered repo decides anything.
- **Ponytail on, full intensity.** Shortest correct diff; no abstractions,
  config or scaffolding nobody asked for.
- **TypeScript**, Node 22.18+, run straight from source (type stripping) in
  development. `tsc` builds `build/` only on install (`prepare`), because Node
  won't strip types inside `node_modules`, which is where `npx` puts it.
  Dependencies pinned to exact versions, the same as WMH's; never auto-upgrade.
- **Design with the skills, never by hand.** Diagrams with `/diagram-design`,
  under this project's own profile (`git-for-me`, set by a `.diagram-design`
  marker), never WMH's yellow one. Logo, social card and any page with
  `/design-taste-frontend`.
- **Name:** "Git for Me" in prose; `git-for-me` for the package, repo and
  command; `git_for_me` for the tools. Never "GFM", which already means GitHub
  Flavored Markdown.
- **Kitbash is GPL-2.0 and not ours.** Never its code or text, and no credit
  in the README (decided 2026-10-14): the search-first design is our own, and
  only the goal, reuse before building, is shared. Kitbash is installed on
  this machine (`P:\windsurf\kitbash`, and as the `kitbash` MCP server): don't
  read its source while working here, so nothing leaks in.
- **American English** in code, docs and commits.
- **General, not tied to any one project.**
- `GITHUB_TOKEN` is read from the environment, sent only to `api.github.com`,
  and never recorded.
- Public on bikemeardsley/git-for-me (from day one; "pre-release" in the
  README until launch), MIT. No CONTRIBUTING.md: issues and private security
  advisories only.
- Tests run offline: GitHub is mocked.
