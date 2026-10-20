---
name: bouncelens-email-check
description: Check email addresses with the BounceLens MCP tools before they are sent to, imported or saved. Use when the user asks if an email is real, wants a list of emails cleaned, or is working with sign-up, contact or CSV data that holds email addresses.
---

# BounceLens email check

The `bouncelens` MCP server has two tools:

- `check_email`: one address
- `check_emails`: up to 500 addresses; returns a `summary` with counts and one result per address, in input order

## When to use it

- The user asks whether an address is real, valid or mistyped.
- The user wants a list cleaned: drop invalid and throwaway addresses, fix typos, remove duplicates.
- Code or data you are working on holds email addresses that will be emailed or imported (seed data, a CSV, a sign-up export). Offer a check; don't run it on data the user didn't ask about.

## Reading the result

| status | Meaning | What to do |
|--------|---------|------------|
| `invalid` | Will bounce: bad syntax, domain doesn't exist, no mail server, or null MX | Drop it, or ask the user for the right address |
| `risky` | Disposable domain, likely typo, no MX record, or the DNS lookup failed | If `did_you_mean` is set, suggest that address. Otherwise flag it and let the user decide |
| `unconfirmed` | Format and domain are OK | Keep it. Don't call it "verified": the mailbox itself isn't checked |

`flags` also marks role addresses (`info@`, `sales@`), free providers and duplicates (Gmail dot and `+tag` variants count as the same inbox).

## Lists longer than 500

Split the list into batches of 500 and call `check_emails` once per batch. For very large files, point the user to the free browser checker at https://bouncelens.com/ (CSV in, clean list out).

## Limits to tell the user

- It never connects to the recipient's mail server, so it can't confirm a mailbox exists.
- Only the domain part of each address leaves the machine, as a DNS-over-HTTPS lookup to Cloudflare (1.1.1.1). The full addresses stay local.
