---
name: git-for-me
description: Find out what open source already has before building something from scratch. Use when the user describes an app, tool, CLI, library or feature they want to build, asks whether something like it already exists, or is about to write code an open-source repo might already cover. Splits the build into parts, searches GitHub, GitLab and Codeberg live for each, decides from what it finds whether to use a repo as is (USE), adapt one (ADAPT), build it (BUILD), or write it without a dependency (WRITE), and checks every repo picked, with licenses, upkeep, forks and mirrors flagged.
---

# Git for me!

What you remember of open source is as old as your training and misses the
long tail. So don't pick from memory: Git for Me! searches GitHub, GitLab and
Codeberg for each part of what the user wants to build, you pick from what it
finds, and it checks every pick live and writes the report the user sees.
Three steps, always in order.

## With the MCP tools

If the `git_for_me`, `git_for_me_search` and `git_for_me_verify` tools are
connected, call `git_for_me` with the need and follow what it returns. It says
what to ask the user first, what to search, and when to call
`git_for_me_verify`.

## Without them

This plugin runs nothing itself. If the tools aren't connected, don't run Git
for Me! with `npx` or any other way, and don't stand in for it with repos you
remember. Tell the user it needs its MCP server, added once with:

```sh
claude mcp add --scope user git-for-me -- npx -y git-for-me
```

then a restart of Claude Code (or `/mcp`). Other clients and the token are in
[USAGE.md](https://github.com/bikemeardsley/git-for-me/blob/main/USAGE.md). If
the user wants an answer before that, say plainly that any repo you name is
from memory and unchecked.

## The report

Show the user the markdown report as it comes back, without restating its
facts from memory. Keep each repo's link, even if you shorten the report.
Public repos need no token, but GitHub allows only 10 searches a minute without
one; a `GITHUB_TOKEN` in the server's own configuration raises that to 30 and
adds private GitHub repos it can see. GitLab and Codeberg need none. Never ask
for a token in the chat.
