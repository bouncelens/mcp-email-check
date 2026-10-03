# BounceLens Email Check – MCP server

[![smithery badge](https://smithery.ai/badge/bouncelens/email-check)](https://smithery.ai/servers/bouncelens/email-check)

Lets Claude, Cursor and other MCP clients check email addresses before you send to them or save them. It finds:

- **Typos** in the domain: `jane@gmial.com` → did you mean `jane@gmail.com`?
- **Disposable / throwaway** domains (mailinator.com, 10minutemail and ~9,000 more)
- **Dead domains**: the domain doesn't exist, has no mail server, or says it accepts no email (null MX)
- **Bad syntax**, **role addresses** (info@, sales@), **free providers**, and **duplicates** (Gmail dot and +tag variants count as the same inbox)
- The **mail provider** behind the domain (Google, Microsoft, Proofpoint, …)

Runs on your machine. **No API key, no account, no sign-up.** The only network calls are DNS lookups over HTTPS (Cloudflare 1.1.1.1). It uses the same checks as the free checker at **[bouncelens.com](https://bouncelens.com/)**.

> It never connects to the recipient's mail server, so it can't confirm that a mailbox exists. The best result is `unconfirmed` (format and domain OK). To check a whole CSV in your browser, use [bouncelens.com](https://bouncelens.com/).

## Install

Requires Node.js 18 or newer. Also listed on [Smithery](https://smithery.ai/servers/bouncelens/email-check).

**Claude Code**

```sh
claude mcp add bouncelens -- npx -y github:bouncelens/mcp-email-check
```

**Claude Desktop, Cursor, Windsurf and other clients.** Add this to the client's MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, …):

```json
{
  "mcpServers": {
    "bouncelens": {
      "command": "npx",
      "args": ["-y", "github:bouncelens/mcp-email-check"]
    }
  }
}
```

**From a clone**

```sh
git clone https://github.com/bouncelens/mcp-email-check.git
cd mcp-email-check && npm install
# then use: "command": "node", "args": ["/path/to/mcp-email-check/index.js"]
```

## Tools

| Tool | Input | Returns |
|------|-------|---------|
| `check_email` | `email` (string) | One result |
| `check_emails` | `emails` (array, max 500) | `summary` with counts + one result per address, in input order |

Each result (real output for a mistyped Outlook address):

```json
{
  "input": "jane@outlok.com",
  "email": "jane@outlok.com",
  "status": "risky",
  "reasons": ["No MX record; mail would go to the website server", "Looks like a typo of outlook.com"],
  "flags": { "disposable": false, "role": false, "free": false, "duplicate": false, "gateway": false },
  "did_you_mean": "jane@outlook.com",
  "provider": null,
  "mx": null
}
```

| status | Meaning |
|--------|---------|
| `invalid` | Will bounce: bad syntax, domain doesn't exist, no mail server, or null MX |
| `risky` | Disposable domain, likely typo, no MX record (mail would go to the web server), or the DNS lookup failed |
| `unconfirmed` | Format and domain OK. The mailbox itself isn't checked |

## Example prompts

- "Check these sign-ups for fake or mistyped emails: …"
- "Is jane@outlok.com a real address?"
- "Clean this list: drop invalid and disposable addresses, fix the typos, remove duplicates."

## Privacy

Addresses never leave your machine. Only the **domain** part is sent to Cloudflare's DNS-over-HTTPS resolver (1.1.1.1) to look up its MX/A records.

## Development

```sh
npm install
npm test          # offline: DNS answers are faked
```

`lib/engine.js` and `data/disposable.json` are generated from the BounceLens main codebase, so change them there.

## More from BounceLens

- [bouncelens.com](https://bouncelens.com/) – free email list checker in your browser (CSV in, clean list out)
- [Craft CMS plugin](https://bouncelens.com/craft/) – blocks fake and mistyped emails in Craft forms

## License

MIT. Disposable-domain list: [disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains) (CC0).
