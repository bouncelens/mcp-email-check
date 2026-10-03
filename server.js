// BounceLens Email Check MCP server: the free checks from bouncelens.com as MCP tools.
// Runs locally, no API key. The only network traffic is DNS-over-HTTPS (Cloudflare 1.1.1.1)
// for the domain's MX/A records. It never connects to a mail server, so it never confirms a
// mailbox exists: the best result is "unconfirmed".
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkEmails, summarize, makeDomainCache, dohResolve } from './lib/engine.js';

export const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
export const MAX_EMAILS = 500;

let disposableCache = null;
export function loadDisposable() {
  disposableCache ??= new Set(JSON.parse(readFileSync(new URL('./data/disposable.json', import.meta.url), 'utf8')));
  return disposableCache;
}

const STATUS_HELP = 'status is "invalid" (will bounce: bad syntax, domain does not exist, no mail server), ' +
  '"risky" (disposable domain, likely typo such as gmial.com, no MX record) or "unconfirmed" ' +
  '(format and domain OK; the mailbox itself is not checked). did_you_mean holds the corrected address for typos.';

const ok = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = message => ({ content: [{ type: 'text', text: message }], isError: true });

// fetchImpl is swapped out by the tests; real use goes straight to DoH.
export function createServer({ fetchImpl = fetch } = {}) {
  const server = new McpServer({ name: 'bouncelens-email-check', version: VERSION });
  const run = list => checkEmails(list, {
    disposable: loadDisposable(),
    lookup: makeDomainCache((name, type) => dohResolve(name, type, fetchImpl)),
    concurrency: 6,
  });

  server.registerTool('check_email', {
    title: 'Check one email address',
    description: 'Check one email address for bad syntax, typos in the domain (gmial.com → gmail.com), ' +
      'disposable/throwaway domains, role addresses (info@, sales@) and domains that do not exist or ' +
      'have no mail server. ' + STATUS_HELP,
    inputSchema: { email: z.string().describe('The email address to check') },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ email }) => {
    const [result] = await run([email]);
    return ok(result);
  });

  server.registerTool('check_emails', {
    title: 'Check a list of email addresses',
    description: `Check up to ${MAX_EMAILS} email addresses at once (same checks as check_email, plus ` +
      'duplicates, counting Gmail dot and +tag variants as the same inbox). Returns a summary with ' +
      'counts and one result per address, in input order. ' + STATUS_HELP,
    inputSchema: { emails: z.array(z.string()).min(1).describe(`Email addresses, at most ${MAX_EMAILS}`) },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ emails }) => {
    if (emails.length > MAX_EMAILS) return fail(`At most ${MAX_EMAILS} emails per call; split the list.`);
    const results = await run(emails);
    return ok({ summary: summarize(results), results });
  });

  return server;
}
