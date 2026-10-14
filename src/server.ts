#!/usr/bin/env node
// Git for Me as an MCP server on stdio. Three tools, called in order: the rubric the agent follows, the search of
// GitHub it picks repos from, then the live check that writes the report the user sees. For an agent without MCP, the
// same three run from a shell: `git-for-me rubric`, `search` and `verify`, JSON on stdin. For a client that speaks
// MCP over HTTP only, `git-for-me --http` serves them at /mcp.
import { createServer } from 'node:http';
import { text } from 'node:stream/consumers';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { rubric } from './rubric.ts';
import { find } from './search.ts';
import { verify } from './verify.ts';

const need = z.string().min(1).describe('What you want to build, in plain words: what goes in, what should come out, and what it is for');
const details = {
  need,
  stack: z.string().optional().describe('What it will be written in, such as "TypeScript on Node" or "Python 3.12"'),
  platform: z.string().optional().describe('Where it will run, such as "a web app", "a CLI" or "a server"'),
  license: z.string().optional().describe('What the result may be used for, such as "commercial, closed source" or "open source"'),
  upkeep: z.string().optional().describe('How much code you are willing to own, such as "needs to stay maintained" or "happy to own a fork"'),
};
const query = {
  topic: z.string().optional().describe('The GitHub topic the job falls under, lowercase and hyphenated, such as "pdf-parser"'),
  language: z.string().optional().describe('Only repos in this language, such as "python"; leave it out to search all'),
  keywords: z.array(z.string().min(1)).max(2).optional().describe('1 or 2 words a fitting repo\'s name or description might hold, such as "pdf"'),
  phrase: z.string().optional().describe('The job in a few words, as a README would put it, such as "extract tables from pdf"'),
};
const wanted = {
  parts: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), ...query })).min(1).max(6), // at most 30 searches a call: GitHub's limit a minute, with a token
};
const slate = {
  need,
  components: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    role: z.string(),
    verdict: z.enum(['USE', 'ADAPT', 'BUILD', 'WRITE']),
    rationale: z.string(),
    search: z.object(query).optional().describe("The part's last git_for_me_search query, unchanged; none for a WRITE part"),
    candidates: z.array(z.object({ id: z.string().min(1).describe('owner/name') })).max(4),
  })).min(1).max(8), // at most 32 lookups a call
};
const verified = async (args: z.infer<z.ZodObject<typeof slate>>) => {
  const { markdown, result } = await verify(args);
  return `${markdown}\n\n<git_for_me_json>\n${JSON.stringify(result)}\n</git_for_me_json>`;
};

function serve() {
  const server = new McpServer({ name: 'git-for-me', version: '0.0.0' });
  server.registerTool('git_for_me', {
    title: 'Git for me',
    description: 'Step 1 of 3, before recommending any GitHub repo or writing something that might already exist. If stack, platform, license or upkeep is missing, returns the questions to ask the user first: call again with the answers ("unknown" is fine). Then returns the method: split what the user wants to build into parts, search GitHub for each with git_for_me_search, and decide from what it finds which parts an existing repo covers (use it as is, adapt it, or build it) and which are plain code. Follow it.',
    inputSchema: details,
  }, async (args) => ({ content: [{ type: 'text', text: rubric(args) }] }));
  server.registerTool('git_for_me_search', {
    title: 'Git for me (searched on GitHub)',
    description: "Step 2 of 3: searches GitHub for each part: the topic's most starred and rising repos, names and descriptions holding each keyword, and README text. Returns what it found, with stars, license, language, last push and how each turned up, to pick each part's verdict and candidates from. Then call git_for_me_verify.",
    inputSchema: wanted,
  }, async ({ parts }) => ({ content: [{ type: 'text', text: await find(parts) }] }));
  server.registerTool('git_for_me_verify', {
    title: 'Git for me (checked on GitHub)',
    description: "Step 3 of 3: checks every picked repo live on GitHub, drops the ones that are not there, flags no license, copyleft, archived, stale, little used and forks, marks picks the search didn't turn up as from memory, shows what it found that wasn't picked, and returns the report to show the user. If nextAction is SEARCH_FIRST or RECALL_REPLACEMENTS, do what its instructions say and call again.",
    inputSchema: slate,
  }, async (args) => ({ content: [{ type: 'text', text: await verified(args) }] }));
  return server;
}

const [command, address = '8000'] = process.argv.slice(2);
const [, host = '127.0.0.1', port] = /^(?:(.+):)?(\d+)$/.exec(address) ?? [];
if (command === 'rubric') console.log(rubric(z.object(details).parse(JSON.parse(await text(process.stdin)))));
else if (command === 'search') console.log(await find(z.object(wanted).parse(JSON.parse(await text(process.stdin))).parts));
else if (command === 'verify') console.log(await verified(z.object(slate).parse(JSON.parse(await text(process.stdin)))));
else if (command === '--http' && port) {
  // For clients that speak MCP over HTTP only, such as Open WebUI. Stateless: a fresh server for each request.
  createServer(async (req, res) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/mcp') return void res.writeHead(404).end();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await serve().connect(transport);
    await transport.handleRequest(req, res);
  }).listen(Number(port), host, () => console.error(`Git for Me at http://${host}:${port}/mcp`));
} else if (command) {
  console.error([
    'Usage: git-for-me                          serve the MCP tools on stdio',
    '       git-for-me --http [[host:]port]     serve them over HTTP at /mcp (default 127.0.0.1:8000)',
    '       git-for-me rubric < details.json',
    '       git-for-me search < parts.json',
    '       git-for-me verify < slate.json',
  ].join('\n'));
  process.exit(2);
} else await serve().connect(new StdioServerTransport());
