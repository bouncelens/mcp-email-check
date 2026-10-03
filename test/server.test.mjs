// MCP server tests. DNS answers are faked, so these run offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createServer, MAX_EMAILS } from '../server.js';
import { dohUrl } from '../lib/engine.js';

const MX = (...hosts) => ({ Status: 0, Answer: hosts.map((h, i) => ({ type: 15, data: `${(i + 1) * 10} ${h}.` })) });
const DNS = {
  [dohUrl('gmail.com', 'MX')]: MX('gmail-smtp-in.l.google.com'),
  [dohUrl('example-company.com', 'MX')]: MX('mx1.example-company.com'),
  [dohUrl('mailinator.com', 'MX')]: MX('mail.mailinator.com'),
  [dohUrl('gmial.com', 'MX')]: MX('mx.gmial.com'),
  [dohUrl('no-such-domain-bl.com', 'MX')]: { Status: 3 },
  [dohUrl('nullmx.example', 'MX')]: { Status: 0, Answer: [{ type: 15, data: '0 .' }] },
};
async function fakeFetch(url) {
  const body = DNS[String(url)];
  return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('', { status: 599 });
}

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer({ fetchImpl: fakeFetch }).connect(a);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(b);
  return client;
}
const call = async (client, name, args) => {
  const res = await client.callTool({ name, arguments: args });
  return { res, data: res.isError ? null : JSON.parse(res.content[0].text) };
};

test('lists the two read-only tools', async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(t => t.name).sort(), ['check_email', 'check_emails']);
  for (const t of tools) assert.equal(t.annotations.readOnlyHint, true);
  await client.close();
});

test('check_email: good, typo, disposable, dead domain, null MX, bad syntax, role', async () => {
  const client = await connect();
  const cases = [
    ['jane@example-company.com', 'unconfirmed'],
    ['jane@gmial.com', 'risky'],
    ['temp@mailinator.com', 'risky'],
    ['x@sub.mailinator.com', 'risky'],
    ['jane@no-such-domain-bl.com', 'invalid'],
    ['jane@nullmx.example', 'invalid'],
    ['not an email', 'invalid'],
    ['info@example-company.com', 'unconfirmed'],
  ];
  for (const [email, status] of cases) {
    const { data } = await call(client, 'check_email', { email });
    assert.equal(data.status, status, email);
  }
  assert.equal((await call(client, 'check_email', { email: 'jane@gmial.com' })).data.did_you_mean, 'jane@gmail.com');
  assert.equal((await call(client, 'check_email', { email: 'temp@mailinator.com' })).data.flags.disposable, true);
  assert.equal((await call(client, 'check_email', { email: 'info@example-company.com' })).data.flags.role, true);
  assert.equal((await call(client, 'check_email', { email: 'a@gmail.com' })).data.provider, 'Google');
  await client.close();
});

test('DNS failure is risky, not invalid', async () => {
  const client = await connect();
  const { data } = await call(client, 'check_email', { email: 'a@unreachable.example' });
  assert.equal(data.status, 'risky');
  assert.match(data.reasons[0], /Could not look up domain/);
  await client.close();
});

test('check_emails: summary, input order, Gmail duplicates', async () => {
  const client = await connect();
  const emails = ['john.smith@gmail.com', 'johnsmith+news@gmail.com', 'bad@', 'temp@mailinator.com'];
  const { data } = await call(client, 'check_emails', { emails });
  assert.deepEqual(data.results.map(r => r.input), emails);
  assert.equal(data.results[1].flags.duplicate, true);
  assert.deepEqual(data.summary, { total: 4, invalid: 1, risky: 1, unconfirmed: 1, duplicates: 1, disposable: 1, role: 0, free: 2, typos: 0 });
  await client.close();
});

test(`check_emails rejects more than ${MAX_EMAILS} addresses and empty lists`, async () => {
  const client = await connect();
  const tooMany = await call(client, 'check_emails', { emails: Array(MAX_EMAILS + 1).fill('a@gmail.com') });
  assert.equal(tooMany.res.isError, true);
  const empty = await client.callTool({ name: 'check_emails', arguments: { emails: [] } });
  assert.equal(empty.isError, true);
  await client.close();
});

test('stdio entry point starts and answers tools/list', async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../index.js', import.meta.url))],
  });
  const client = new Client({ name: 'stdio-test', version: '0' });
  await client.connect(transport);
  assert.equal(client.getServerVersion().name, 'bouncelens-email-check');
  assert.equal((await client.listTools()).tools.length, 2);
  await client.close();
});
