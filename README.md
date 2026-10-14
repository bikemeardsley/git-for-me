<h1 align="center">Git for Me</h1>

<p align="center">
  <a href="https://github.com/bikemeardsley/git-for-me/actions/workflows/test.yml"><img src="https://github.com/bikemeardsley/git-for-me/actions/workflows/test.yml/badge.svg" alt="Tests"></a>
  <a href="https://github.com/search"><img src="https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white" alt="GitHub"></a>
  <a href="#development"><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="#development"><img src="https://img.shields.io/badge/node-%E2%89%A522.18-339933?logo=nodedotjs&logoColor=white" alt="Node 22.18 or later"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <br>
  <a href="https://buymeacoffee.com/bikemeardsley"><img src="https://img.shields.io/badge/Buy_Me_a_Coffee-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>
  <a href="https://www.als.net/donate/"><img src="https://img.shields.io/badge/Donate-ALS_Research-blueviolet" alt="Donate to ALS research"></a>
</p>

Tell your AI agent what you want to build. It searches GitHub for each part of
the job and tells you which parts already exist there: which to use as they
are, which to adapt, which to build, and which are just code. Every repo it
names is real, licensed for your use or flagged, and checked live.

Its companion, [Where My Hug At?](https://github.com/bikemeardsley/where-my-hug),
does the same for Hugging Face models.

> **Status: pre-release.** The three tools work from source; packaging,
> install routes and listings come at launch.

## Contents

- [Try it](#try-it)
- [How it works](#how-it-works): [four questions](#1-four-questions-first) ·
  [parts](#2-split-the-job) · [the search](#3-search-github-for-each-part) ·
  [verdicts](#4-decide-each-part-from-what-turned-up) ·
  [the live check](#5-check-every-pick) · [flags](#flags)
- [GITHUB_TOKEN](#github_token) · [What leaves your machine](#what-leaves-your-machine) ·
  [Limits](#limits) · [Security](#security)
- [Development](#development) · [License](#license)

## Try it

From a clone, add it to your agent (Claude Code here):

```sh
npm install
claude mcp add --scope user git-for-me -- node /path/to/git-for-me/src/server.ts
```

Then ask:

> **Git for me: a CLI that pulls the tables out of PDF invoices into a spreadsheet.**

Your agent asks the few things it can't guess, splits the job into parts,
searches GitHub for each, and comes back with a report, every repo in it
looked up on GitHub moments before.

## How it works

### 1. Four questions first

Ask for "a library that reads PDFs" and you get whatever is popular: in the
wrong language, under a license you can't ship, or abandoned years ago. So
before anything is named, four details come first. Your agent fills in what
the conversation or your codebase already says, and asks you the rest:

| | What it asks | What that decides |
|---|---|---|
| **Stack** | What will it be written in?<br>_TypeScript on Node, Python 3.12, Rust_ | Which repos work as libraries, and which only beside your code |
| **Platform** | Where will it run?<br>_a web app, a CLI, a server, a phone app_ | What fits at all |
| **License** | What may the result be used for?<br>_commercial, open source, personal_ | Which licenses are allowed |
| **Upkeep** | How much code are you willing to own?<br>_needs to stay maintained, happy to own a fork_ | A maintained dependency, or a fork you keep up |

"Not sure yet" is a fine answer: the picks then cover the range.

### 2. Split the job

The agent breaks the need into parts, each with an input and an output (a PDF
→ its tables, tables → a spreadsheet). A part not worth a dependency (glue,
configuration, logic only your project has, a few lines) is marked **WRITE**:
a dependency for ten lines is a cost, not a feature.

### 3. Search GitHub for each part

What an agent remembers of GitHub is as old as its training, and misses the
long tail. So nothing is picked from memory. For every other part, the agent
writes a search (a GitHub topic, the stack's language, a few keywords, the job
in a few words), and it runs four ways:

| Way | What it finds |
|---|---|
| Most starred in the topic | What's proven |
| Rising in the topic | New repos gaining stars, including ones newer than the agent's training |
| Names and descriptions holding each keyword | Tools that aren't tagged with the topic |
| README text | The long tail, by what the README says, like a web search |

The ways take turns in the results, so a niche tool isn't buried under
whatever is most starred. Archived repos are left out.

### 4. Decide each part from what turned up

| Verdict | Meaning |
|---|---|
| **USE** | A repo the search found does this job as it is: depend on it, or run it beside your code. |
| **ADAPT** | One comes close: fork it or copy the part you need, license permitting. |
| **BUILD** | Nothing it found does the job: build it, reading the closest repos first. |
| **WRITE** | Not worth a dependency: write the code. |

The agent judges the results by what they say: description, stars, recent
pushes, license, language. It may add a repo it knows that the search missed,
but that pick ranks after the search's, and the report marks it **from
memory**.

### 5. Check every pick

Every pick is looked up on GitHub, live. Any that don't exist are dropped,
and the agent goes back to the search for others. The rest are flagged for
what would bite later, and that report is what you see. It also lists what
the search found that wasn't picked, so nothing it turned up is hidden. A
BUILD part whose search found repos says to check them before building one.

Under the hood it's an MCP server with three tools: `git_for_me` for the
method (steps 1, 2 and 4), `git_for_me_search` for step 3, and
`git_for_me_verify` for step 5.

### Flags

| Flag | When |
|---|---|
| UNCHECKED | GitHub didn't answer (down, rate-limited). The repo is kept, and asked again next time. |
| ARCHIVED | Read-only: every fix is yours. |
| NO_LICENSE | No license: all rights reserved, so its code may not be reused. |
| OWN_TERMS | A license GitHub can't identify: read it. |
| COPYLEFT | GPL, LGPL, AGPL, MPL and kin: using or changing it can bind your code to its license. |
| STALE | No pushes in two years. |
| LITTLE_USED | Under 50 stars. |
| FORK | A fork: check whether the original is the better pick. |

## GITHUB_TOKEN

Optional, and worth setting. Without one, GitHub allows 10 searches a minute,
which covers about two parts; with one, 30. A token with no scopes is enough
for public repos. Pass it to the server as `GITHUB_TOKEN`; it is sent only to
`api.github.com` and never appears in a report. Without a token, a private
repo looks missing, because GitHub answers 404 for both.

## What leaves your machine

The search the agent writes for each part (a topic, a language, keywords, a
few words about the job) and the repos it picks, as GETs to `api.github.com`,
plus your token if you set one. The need as you wrote it, the method and the
report stay between you and your agent.

## Limits

- The search finds what GitHub's search can: topics, names, descriptions and
  README text. A repo with none of those words can still be missed.
- "Rising" is the topic's most starred repos created in the last half year:
  GitHub has no trending API.
- License flags read GitHub's license detection, not the license text.

## Security

Report a vulnerability privately through
[GitHub Security Advisories](https://github.com/bikemeardsley/git-for-me/security/advisories/new),
not a public issue. [SECURITY.md](SECURITY.md) lists what it touches: GETs to
GitHub, and nothing on your machine.

## Development

```sh
node src/server.ts   # the server, straight from source
npm test             # offline: GitHub is mocked, and the server is driven over stdio and HTTP
npm run check        # types
```

`npm install` also builds JavaScript into `build/`, which is what `npx` runs:
Node won't strip types from a package inside `node_modules`.

## License

MIT
