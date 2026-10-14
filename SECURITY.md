# Security

## Supported versions

Fixes ship on `main` and in the next npm release. Use the latest of either.

| Version | Supported |
| --- | --- |
| latest npm release, `main` | ✅ |
| older releases | ❌ |

## Reporting a vulnerability

Report it privately through
[GitHub Security Advisories](https://github.com/bikemeardsley/git-for-me/security/advisories/new).
Please don't open a public issue for a vulnerability.

Include what you can: the version or commit, steps to reproduce, and what an
attacker gains.

## What Git for Me touches

- **The network:** `GET` requests to `api.github.com`: repository searches
  built from what the agent writes for each part of a need (a topic, a
  language, keywords, a few words about the job), and one lookup per repo it
  picks, to check it exists and read its facts. Nothing else is contacted.
- **`GITHUB_TOKEN`:** read from the environment if set, sent only to
  `api.github.com`, and never written to a report, a log or a file.
- **Your machine:** it reads no files, writes no files and runs no commands.
- **`--http`:** serves the same three tools on a port, on 127.0.0.1 unless you
  give it a host. Anyone who can reach that port can use them, and with
  `GITHUB_TOKEN` set that includes looking up private repos the token can see.
