# Installing Git for Me! (for an AI agent)

Git for Me! is a local MCP server, published on npm as `git-for-me`. There is
nothing to clone or build and no API key to obtain.

## Requirements

- Node.js 22.18 or later. Check with `node --version`. If it is older or
  missing, ask the user to install a current Node.js LTS from
  https://nodejs.org before continuing.

## Add the server

Add this entry to the MCP settings (for Cline: `cline_mcp_settings.json`,
opened from the MCP Servers panel, Configure tab):

```json
{
  "mcpServers": {
    "git-for-me": {
      "command": "npx",
      "args": ["-y", "git-for-me"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Keep any servers already in the file; add `git-for-me` beside them.

## Optional: a GitHub token

Everything public works without one, but GitHub then allows only 10 searches a
minute, which covers about two parts of a job. Only if the user wants that
raised to 30, or wants private repos their GitHub account can see, ask them for
a token (never invent one; one with no scopes is enough) and add it as an
environment variable on the same entry:

```json
"env": { "GITHUB_TOKEN": "github_pat_..." }
```

The token is sent only to api.github.com. GitLab and Codeberg need none.

## Check it works

1. The server should show as connected with three tools: `git_for_me`,
   `git_for_me_search` and `git_for_me_verify`. The first start downloads the
   package and can take a few seconds.
2. Try it: ask "Git for me: a CLI that pulls the tables out of PDF invoices
   into a spreadsheet." Call `git_for_me` with the need. It returns questions
   about stack, platform, license and upkeep; ask the user, call it again with
   the answers, and follow the method it returns: search each part with
   `git_for_me_search`, pick from what it finds, then call `git_for_me_verify`
   and show the user the report it returns.

## If it doesn't start

- `npx` not found: Node.js isn't on the PATH; reinstall Node.js.
- Timed out on first start: start it again (the package is cached after the
  first run), or install it once with `npm install -g git-for-me` and use
  `"command": "git-for-me"` with no `args`.
