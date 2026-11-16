# Git for Me! (plugin)

Odds are, most of what you want to build is already open source. Tell your AI
agent what you're making: it searches GitHub, GitLab and Codeberg for each part
of the job and tells you which repos to use as they are, which to adapt, and
what's left for you to write. Every repo it picks is checked live and flagged
for license, upkeep, forks and mirrors.

This plugin adds one thing to Claude Code: **the `git-for-me` skill**, which
tells Claude when to use Git for Me! and runs its three steps with
`npx -y git-for-me` in a shell, from the
[npm package](https://www.npmjs.com/package/git-for-me). That makes `GET`
requests to `api.github.com`, `gitlab.com/api` and `codeberg.org/api`
(searches from what your agent writes for each part of the job, and the repos
it picks), and nothing else. `npx` downloads the package from the npm registry
(`registry.npmjs.org`) when it runs.

For the same steps as MCP tools, with no shell commands to approve, add the
server too:

```sh
claude mcp add --scope user git-for-me -- npx -y git-for-me
```

An optional `GITHUB_TOKEN` in your environment (or, with the server, given to
`claude mcp add` as `-e GITHUB_TOKEN=...`) raises GitHub's search limit from 10
a minute to 30 and adds private repos your account can see. A token with no
scopes is enough. It is sent only to api.github.com.

Try: _"Git for me: a CLI that pulls the tables out of PDF invoices into a spreadsheet."_

Source, full documentation and other agents:
[github.com/bikemeardsley/git-for-me](https://github.com/bikemeardsley/git-for-me).
MIT licensed.
