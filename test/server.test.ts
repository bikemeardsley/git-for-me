import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const server = fileURLToPath(new URL('../src/server.ts', import.meta.url));
const TOOLS = ['git_for_me', 'git_for_me_search', 'git_for_me_verify'];
// A WRITE part may leave out its candidates: it has none.
const WRITE_ONLY = { need: 'turn PDFs into spreadsheets', components: [{ id: 'glue', name: 'Glue', role: 'rows -> a CSV', verdict: 'WRITE', rationale: "the standard library's csv writer" }] };

test('serves the three tools over stdio, as Claude Code starts it', async () => {
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server] }));
  try {
    assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), TOOLS);

    const text = (result: Awaited<ReturnType<typeof client.callTool>>) => (result.content as { text: string }[])[0].text;
    // Details that change the answer come first: only the missing ones are asked, and no method until they're in.
    const asked = text(await client.callTool({ name: 'git_for_me', arguments: { need: 'turn PDFs into spreadsheets', stack: 'Python' } }));
    assert.match(asked, /Need: turn PDFs into spreadsheets/);
    assert.deepEqual([...asked.matchAll(/^- (\w+):/gm)].map((match) => match[1]), ['platform', 'license', 'upkeep']);
    assert.doesNotMatch(asked, /Split the need/);
    const method = text(await client.callTool({
      name: 'git_for_me', arguments: { need: 'turn PDFs into spreadsheets', stack: 'Python', platform: 'a CLI', license: 'unknown', upkeep: 'a one-off' },
    }));
    assert.match(method, /License: unknown\n/);
    assert.match(method, /Split the need/);

    // A slate with nothing to look up never reaches the network.
    const verified = text(await client.callTool({ name: 'git_for_me_verify', arguments: WRITE_ONLY }));
    assert.match(verified, /^# Git for me!/);
    assert.match(verified, /"nextAction":"DONE"/);

    assert.equal((await client.callTool({ name: 'git_for_me_verify', arguments: { need: 'x', components: [] } })).isError, true);
    assert.equal((await client.callTool({ name: 'git_for_me_search', arguments: { parts: [] } })).isError, true);
  } finally {
    await client.close();
  }
});

test('serves the same tools over HTTP, for clients that speak only that', async () => {
  const child = spawn(process.execPath, [server, '--http', '127.0.0.1:38127']);
  await new Promise((resolve) => child.stderr.once('data', resolve)); // listening
  const client = new Client({ name: 'test', version: '0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:38127/mcp')));
    assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), TOOLS);
    assert.equal((await fetch('http://127.0.0.1:38127/elsewhere')).status, 404);
  } finally {
    await client.close();
    child.kill();
  }
});

test('runs the same three steps from a shell, for an agent without MCP', () => {
  const run = (command: string, input: object) =>
    execFileSync(process.execPath, [server, command], { input: JSON.stringify(input), encoding: 'utf8', stdio: 'pipe' });
  assert.match(run('rubric', { need: 'turn PDFs into spreadsheets', stack: 'Python' }), /^- platform:/m);
  const report = run('verify', WRITE_ONLY);
  assert.match(report, /^# Git for me!/);
  assert.match(report, /"nextAction":"DONE"/);
  assert.throws(() => run('verify', { need: 'x', components: [] })); // the same checks as the tool
  // A mistake is said plainly, for the agent to fix, not as a stack trace.
  assert.throws(() => run('search', { components: [] }), (error: { stderr: string }) =>
    /git-for-me search: the JSON on stdin doesn't fit\.\n.*parts/s.test(error.stderr) && !/server\.ts/.test(error.stderr));
});

test("the plugin's copy of the skill is the skill", () => {
  const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
  assert.equal(read('../plugin/skills/git-for-me/SKILL.md'), read('../skills/git-for-me/SKILL.md'));
});
