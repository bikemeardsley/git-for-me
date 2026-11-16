# Git for Me! (plugin)

Odds are, most of what you want to build is already open source. Tell your AI
agent what you're making: it searches GitHub, GitLab and Codeberg for each part
of the job and tells you which repos to use as they are, which to adapt, and
what's left for you to write. Every repo it picks is checked live and flagged
for license, upkeep, forks and mirrors.

**Add the MCP server once, then restart Claude Code:**

```sh
claude mcp add --scope user git-for-me -- npx -y git-for-me
```

This plugin is **the `git-for-me` skill** alone, which tells Claude when to use
the server's three tools and how. It runs nothing itself: without the server,
it asks you to add it.

The server is the [npm package](https://www.npmjs.com/package/git-for-me),
which `npx` downloads from the npm registry (`registry.npmjs.org`). It makes
`GET` requests to `api.github.com`, `gitlab.com/api` and `codeberg.org/api`
(searches from what your agent writes for each part of the job, and the repos
it picks), and nothing else. It reads and writes no files.

An optional GitHub token raises GitHub's search limit from 10 a minute to 30
and adds private repos your account can see. A token with no scopes is enough,
and it is sent only to api.github.com:

```sh
claude mcp add --scope user git-for-me -e GITHUB_TOKEN=github_pat_... -- npx -y git-for-me
```

Try: _"Git for me: a CLI that pulls the tables out of PDF invoices into a spreadsheet."_

Source, full documentation and other agents:
[github.com/bikemeardsley/git-for-me](https://github.com/bikemeardsley/git-for-me).
MIT licensed.
