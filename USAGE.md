# Using Git for Me!

Setup for each agent, then what to expect when you use it. The
[README](README.md) has the short version.

- [Before you start](#before-you-start)
- [Using it](#using-it)
- Agents: [Claude Code](#claude-code) · [Claude Desktop](#claude-desktop) ·
  [Codex](#codex) · [GitHub Copilot CLI](#github-copilot-cli) ·
  [VS Code (Copilot)](#vs-code-copilot) · [Cursor](#cursor) ·
  [Windsurf / Devin Desktop](#windsurf--devin-desktop) · [Devin](#devin) ·
  [Cline](#cline) · [Gemini CLI](#gemini-cli) · [Goose](#goose) ·
  [OpenCode](#opencode) · [Zed](#zed) · [JetBrains Junie](#jetbrains-junie) ·
  [Kiro](#kiro) · [Amp](#amp) · [Warp](#warp) · [Continue](#continue) ·
  [LM Studio](#lm-studio) · [Hermes Agent](#hermes-agent) ·
  [Mistral Vibe](#mistral-vibe) · [Open WebUI](#open-webui)
- [As an Agent Skill](#as-an-agent-skill)
- [Updating](#updating) · [Troubleshooting](#troubleshooting)

## Before you start

- **Node.js 22.18 or later** ([nodejs.org](https://nodejs.org)). Every route
  below runs `npx -y git-for-me`, which downloads the
  [npm package](https://www.npmjs.com/package/git-for-me) and runs it.
- **A GitHub token is optional, and worth setting.** Without one, GitHub allows
  10 searches a minute, which covers about two parts of a job; with one, 30.
  A [fine-grained token](https://github.com/settings/personal-access-tokens/new)
  with no permissions is enough for public repos. Pass it as `GITHUB_TOKEN`,
  shown for each agent below. It is sent only to api.github.com. GitLab and
  Codeberg need none.

The server config most agents take, in one place:

```json
{ "mcpServers": { "git-for-me": { "command": "npx", "args": ["-y", "git-for-me"] } } }
```

## Using it

Ask your agent in plain words, starting with the hook if you like:

> Git for me: a CLI that pulls the tables out of PDF invoices into a spreadsheet.

1. **Four questions.** The agent fills in what the conversation or your
   codebase already says about stack (what it's written in), platform (where
   it runs), license (what the result may be used for) and upkeep (how much
   code you're willing to own), and asks you the rest. "Not sure yet" is a
   fine answer.
2. **Parts and verdicts.** It splits the job into parts, searches GitHub,
   GitLab and Codeberg for each, and marks each USE, ADAPT, BUILD or WRITE,
   naming exact repos.
3. **The live check.** Every repo is looked up on its forge. Missing ones are
   dropped and the agent proposes others; the rest are flagged for license,
   upkeep, forks and mirrors. The report you see comes from that check.

Agents usually call it on their own when you describe something to build. To
be sure, name it: "git for me".

## Claude Code

As a plugin (the tools plus a skill that knows when to use them):

```
/plugin marketplace add bikemeardsley/git-for-me
/plugin install git-for-me@git-for-me
```

It asks for the optional GitHub token and keeps it in secure storage.

Or the tools alone:

```sh
claude mcp add --scope user git-for-me -- npx -y git-for-me
# with a token (the name comes before -e, which takes every value after it):
# claude mcp add --scope user git-for-me -e GITHUB_TOKEN=github_pat_... -- npx -y git-for-me
```

Docs: [plugins](https://code.claude.com/docs/en/plugins/install) ·
[MCP](https://code.claude.com/docs/en/mcp)

## Claude Desktop

Settings → Developer → Edit Config opens `claude_desktop_config.json`. Add the
server under `mcpServers` (with `"env": { "GITHUB_TOKEN": "github_pat_..." }`
if you want one), save, and restart Claude Desktop.

Docs: [local MCP servers](https://modelcontextprotocol.io/docs/develop/connect-local-servers)

## Codex

As a plugin (tools plus skill):

```sh
codex plugin marketplace add bikemeardsley/git-for-me
codex plugin add git-for-me@git-for-me
```

Or in `~/.codex/config.toml`. Codex gives a server 10 seconds to start by
default, so allow more for the first download:

```toml
[mcp_servers.git-for-me]
command = "npx"
args = ["-y", "git-for-me"]
startup_timeout_sec = 120
# env = { GITHUB_TOKEN = "github_pat_..." }
```

Docs: [Codex MCP](https://developers.openai.com/codex/mcp) ·
[config reference](https://developers.openai.com/codex/config-reference)

## GitHub Copilot CLI

```sh
copilot plugin marketplace add bikemeardsley/git-for-me
copilot plugin install git-for-me@git-for-me
```

Docs: [Copilot CLI plugins](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing)

## VS Code (Copilot)

Add `.vscode/mcp.json` to a project, or run **MCP: Open User Configuration**
for every project. VS Code's key is `servers`:

```json
{
  "servers": {
    "git-for-me": { "type": "stdio", "command": "npx", "args": ["-y", "git-for-me"] }
  }
}
```

Docs: [MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)

## Cursor

Add the server to `~/.cursor/mcp.json` (every project) or `.cursor/mcp.json`
(one project), under `mcpServers`.

Docs: [Cursor MCP](https://cursor.com/docs/context/mcp)

## Windsurf / Devin Desktop

Open the MCP settings from Cascade (the hammer icon → Configure), which edits
`mcp_config.json`, and add the server under `mcpServers`.

Docs: [Cascade MCP](https://docs.devin.ai/desktop/cascade/mcp)

## Devin

- **Devin CLI:** `devin plugins install bikemeardsley/git-for-me` (it reads the
  same plugin as Claude Code).
- **Devin (cloud):** Customize → MCPs → Add custom MCP, transport stdio,
  command `npx`, args `-y git-for-me`.

Docs: [Devin CLI plugins](https://docs.devin.ai/cli/extensibility/plugins/overview) ·
[Devin MCP](https://docs.devin.ai/work-with-devin/mcp.md)

## Cline

MCP Servers panel → Configure → edit `cline_mcp_settings.json` and add the
server under `mcpServers`. Or ask Cline to install it: it follows
[llms-install.md](llms-install.md).

Docs: [Cline MCP](https://docs.cline.bot/mcp-servers/configuring-mcp-servers)

## Antigravity CLI

```sh
agy plugin install https://github.com/bikemeardsley/git-for-me/tree/main/plugin
```

The plugin brings the skill and the MCP server. Coming from the Gemini CLI
extension? `agy plugin import gemini` converts it.

## Gemini CLI

```sh
gemini extensions install https://github.com/bikemeardsley/git-for-me
```

Or add the server under `mcpServers` in `~/.gemini/settings.json`.

Docs: [Gemini CLI extensions](https://google-gemini.github.io/gemini-cli/docs/extensions/) ·
[MCP](https://geminicli.com/docs/tools/mcp-server)

## Goose

`goose configure` → Add Extension → Command-line Extension, command
`npx -y git-for-me`. Or in `~/.config/goose/config.yaml`:

```yaml
extensions:
  git-for-me:
    type: stdio
    cmd: npx
    args: ["-y", "git-for-me"]
    enabled: true
    timeout: 300
```

Docs: [Goose extensions](https://goose-docs.ai/docs/guides/config-files)

## OpenCode

In `opencode.json`:

```json
{ "mcp": { "git-for-me": { "type": "local", "command": ["npx", "-y", "git-for-me"] } } }
```

Docs: [OpenCode MCP](https://opencode.ai/docs/mcp-servers)

## Zed

In Zed's `settings.json`:

```json
{ "context_servers": { "git-for-me": { "command": "npx", "args": ["-y", "git-for-me"] } } }
```

Docs: [Zed MCP](https://zed.dev/docs/ai/mcp)

## JetBrains Junie

Add the server under `mcpServers` in `~/.junie/mcp/mcp.json` (or
`.junie/mcp/mcp.json` in a project). JetBrains AI Assistant takes the same
JSON in Settings → Tools → AI Assistant → MCP.

Docs: [Junie MCP](https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html) ·
[AI Assistant MCP](https://www.jetbrains.com/help/ai-assistant/mcp.html)

## Kiro

Add the server under `mcpServers` in `~/.kiro/settings/mcp.json` (or
`.kiro/settings/mcp.json` in a project).

Docs: [Kiro MCP](https://kiro.dev/docs/cli/mcp/configuration)

## Amp

In `~/.config/amp/settings.json`:

```json
{ "amp.mcpServers": { "git-for-me": { "command": "npx", "args": ["-y", "git-for-me"] } } }
```

Docs: [Amp MCP](https://ampcode.com/docs/customize/mcp)

## Warp

Settings → AI → MCP Servers → Add, then paste the JSON from
[Before you start](#before-you-start). Warp also picks up servers already set
up for Claude Code or Codex.

Docs: [Warp MCP](https://docs.warp.dev/agents/capabilities/mcp)

## Continue

In `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: git-for-me
    type: stdio
    command: npx
    args: ["-y", "git-for-me"]
```

Docs: [Continue MCP](https://docs.continue.dev/customize/deep-dives/mcp)

## LM Studio

Program → Install → Edit mcp.json, and add the server under `mcpServers`.
Use a model with tool calling.

Docs: [LM Studio MCP](https://lmstudio.ai/docs/app/mcp)

## Hermes Agent

In `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  git-for-me:
    command: npx
    args: ["-y", "git-for-me"]
```

Docs: [Hermes MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)

## Mistral Vibe

In `~/.vibe/config.toml`:

```toml
[[mcp_servers]]
name = "git-for-me"
transport = "stdio"
command = "npx"
args = ["-y", "git-for-me"]
```

Docs: [Vibe MCP](https://docs.mistral.ai/en/vibe/code/cli/mcp-servers)

## Open WebUI

Open WebUI speaks MCP over HTTP, so run the server in HTTP mode:

```sh
npx -y git-for-me --http 0.0.0.0:8000
```

Then Admin Settings → External Tools → add `http://<host>:8000/mcp`, type
MCP (Streamable HTTP). Without a host it listens on 127.0.0.1 only. Anyone who
can reach the port can use it, including, with `GITHUB_TOKEN` set, looking up
private repos the token can see.

Docs: [Open WebUI MCP](https://docs.openwebui.com/features/extensibility/mcp/)

## As an Agent Skill

For agents that read `SKILL.md` (Cline, Cursor, Copilot, Goose, OpenCode,
Amp, Zed, Junie, Hermes, Mistral Vibe and more):

```sh
npx skills add bikemeardsley/git-for-me
```

The skill uses the MCP tools when they're connected, and otherwise runs the
same three steps from a shell:

```sh
npx -y git-for-me rubric < details.json
npx -y git-for-me search < parts.json
npx -y git-for-me verify < slate.json
```

From a shell, a search GitHub turns away for its rate limit waits up to a
minute for the limit to lift, then asks once more.

Listing: [skills.sh](https://skills.sh/bikemeardsley/git-for-me/git-for-me)

## Updating

`npx -y git-for-me` runs the latest release. The Claude Code, Codex, Copilot
and Gemini plugins pin a version and update with the plugin (`/plugin update`
in Claude Code). A global install updates with
`npm install -g git-for-me@latest`.

## Troubleshooting

- **It never connects:** check `node --version` is 22.18 or later, and that
  `npx -y git-for-me --help` prints the usage.
- **It times out on first start:** the first run downloads the package. Give
  the agent longer (Claude Code reads `MCP_TIMEOUT`; Codex
  `startup_timeout_sec`), or install it once with `npm install -g git-for-me`
  and use `git-for-me` as the command.
- **Searches "didn't answer":** GitHub's search limit, 10 a minute without a
  token. Set `GITHUB_TOKEN`, or wait a minute and search again; what did
  answer is kept for an hour.
- **A private repo shows as missing:** set `GITHUB_TOKEN`. Without one, GitHub
  answers "not found" for private repos. Private repos on GitLab and Codeberg
  aren't seen.
- **Anything else:** [open an issue](https://github.com/bikemeardsley/git-for-me/issues).
