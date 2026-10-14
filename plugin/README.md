# Git for Me (plugin)

Odds are, most of what you want to build is already open source. Tell your AI
agent what you're making: it searches GitHub, GitLab and Codeberg for each part
of the job and tells you which repos to use as they are, which to adapt, and
what's left for you to write. Every repo it picks is checked live and flagged
for license, upkeep, forks and mirrors.

This plugin adds two things to Claude Code:

- **The `git-for-me` MCP server**, run with `npx -y git-for-me@0.1.0` from the
  [npm package](https://www.npmjs.com/package/git-for-me). It makes `GET`
  requests to `api.github.com`, `gitlab.com/api` and `codeberg.org/api`
  (searches from what your agent writes for each part of the job, and the repos
  it picks), and nothing else. It reads and writes no files. `npx` downloads
  the package from the npm registry (`registry.npmjs.org`) when it starts.
- **The `git-for-me` skill**, which tells Claude when to use it. If the server
  isn't connected, the skill runs the same three steps with `npx -y git-for-me`
  in a shell, which reaches the same places: the npm registry and the three
  forges' APIs.

An optional GitHub token, asked for when you enable the plugin and kept in
secure storage, raises GitHub's search limit from 10 a minute to 30 and adds
private repos your account can see. A token with no scopes is enough. It is
sent only to api.github.com.

Try: _"Git for me: a CLI that pulls the tables out of PDF invoices into a spreadsheet."_

Source, full documentation and other agents:
[github.com/bikemeardsley/git-for-me](https://github.com/bikemeardsley/git-for-me).
MIT licensed.
