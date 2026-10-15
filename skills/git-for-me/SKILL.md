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

## Without them, from a shell

The same three steps run from a shell. Node 22.18 or later is needed. Write the
JSON to a file and pass it on stdin:

1. `npx -y git-for-me rubric < details.json`, where
   the file holds `{"need": "...", "stack": "...", "platform": "...", "license": "...", "upkeep": "..."}`.
   Fill what the conversation or codebase already says and leave the rest
   out. If it returns questions, ask the user, then run it again with the
   answers ("unknown" is fine).
2. Follow the method it returns. Where it says to call
   `git_for_me_search`, write `{"parts": [...]}` to a file and run
   `npx -y git-for-me search < parts.json`.
3. Pick from what it found. Where the method says to call
   `git_for_me_verify`, write that JSON to a file and run
   `npx -y git-for-me verify < slate.json`.
   If its JSON says `SEARCH_FIRST` or `RECALL_REPLACEMENTS`, do what its
   instructions say and run it again.

From a shell, a search GitHub turns away for its rate limit waits up to a
minute for the limit to lift, so give these commands two minutes.

Show the user the markdown report as it comes back, without restating its
facts from memory. Public repos need no token, but GitHub allows only 10
searches a minute without one; a `GITHUB_TOKEN` in the server's own
configuration raises that to 30 and adds private GitHub repos it can see.
GitLab and Codeberg need none. Never ask for a token in the chat.
