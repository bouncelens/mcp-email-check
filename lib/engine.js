// GENERATED from site/assets/engine.js by scripts/build-mcp.mjs. Do not edit.
// BounceLens free-check engine. Runs in the browser, in Cloudflare Pages Functions and in Node.
// Free checks only: syntax, typo, domain/MX, disposable, role, free provider, duplicates, provider.
// It never confirms a mailbox exists — the best free result is "unconfirmed".

export const STATUS = {
  INVALID: 'invalid',         // will bounce: bad syntax, no domain, null MX
  RISKY: 'risky',             // disposable, typo-squat, no MX (A fallback), odd syntax
  UNCONFIRMED: 'unconfirmed', // format + domain OK, mailbox NOT confirmed
};

const ROLE = new Set(('abuse admin administrator all billing contact contactus customerservice ' +
  'dev devnull enquiries enquiry feedback finance hello help helpdesk hostmaster hr info inquiries ' +
  'inquiry jobs legal mail mailer-daemon marketing media newsletter no-reply noc noreply null office ' +
  'orders postmaster press privacy recruitment root sales security service spam support team test ' +
  'webmaster welcome careers accounts accounting partners').split(' '));

const FREE = new Set(('gmail.com googlemail.com yahoo.com yahoo.co.in yahoo.co.uk ymail.com rocketmail.com ' +
  'outlook.com hotmail.com hotmail.co.uk live.com msn.com icloud.com me.com mac.com aol.com ' +
  'proton.me protonmail.com pm.me zoho.com zohomail.in gmx.com gmx.de gmx.net web.de mail.com ' +
  'yandex.com yandex.ru mail.ru rediffmail.com tutanota.com tuta.io fastmail.com hey.com qq.com ' +
  '163.com 126.com naver.com daum.net libero.it orange.fr free.fr laposte.net t-online.de').split(' '));

// Domains people most often mistype. Typo suggestions only point at these.
const POPULAR = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com',
  'live.com', 'msn.com', 'yahoo.co.in', 'rediffmail.com', 'protonmail.com', 'proton.me', 'zoho.com',
  'gmx.com', 'yandex.com', 'mail.com', 'hotmail.co.uk', 'yahoo.co.uk', 'googlemail.com', 'me.com'];

// MX host suffix -> provider. Order matters: gateways before mailbox hosts.
const PROVIDERS = [
  ['pphosted.com', 'Proofpoint'], ['ppe-hosted.com', 'Proofpoint'], ['mimecast.com', 'Mimecast'],
  ['barracudanetworks.com', 'Barracuda'], ['iphmx.com', 'Cisco Secure Email'],
  ['messagelabs.com', 'Broadcom MessageLabs'], ['trendmicro.com', 'Trend Micro'],
  ['google.com', 'Google'], ['googlemail.com', 'Google'], ['outlook.com', 'Microsoft'],
  ['hotmail.com', 'Microsoft'], ['yahoodns.net', 'Yahoo'], ['zoho.com', 'Zoho'], ['zoho.in', 'Zoho'],
  ['zoho.eu', 'Zoho'], ['protonmail.ch', 'Proton'], ['messagingengine.com', 'Fastmail'],
  ['icloud.com', 'Apple iCloud'], ['duck.com', 'DuckDuckGo relay'], ['mx.cloudflare.net', 'Cloudflare Email Routing'],
  ['secureserver.net', 'GoDaddy'], ['titan.email', 'Titan'], ['yandex.net', 'Yandex'],
  ['mail.ru', 'Mail.ru'], ['amazonaws.com', 'Amazon SES/WorkMail'], ['emailsrvr.com', 'Rackspace'],
];
const GATEWAYS = new Set(['Proofpoint', 'Mimecast', 'Barracuda', 'Cisco Secure Email',
  'Broadcom MessageLabs', 'Trend Micro']);

const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export function suggestDomain(domain) {
  if (POPULAR.includes(domain) || FREE.has(domain)) return null;
  let best = null, bestDist = 3;
  for (const p of POPULAR) {
    const d = levenshtein(domain, p);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  // 1 edit always counts; 2 edits only for longer names (avoids gmx.com -> gmail.com style jumps).
  if (best && (bestDist === 1 || (bestDist === 2 && domain.length >= 9))) return best;
  return null;
}

// RFC 3492 punycode for one label. Own copy because Apps Script has no URL class.
function punycode(label) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const cps = Array.from(label, c => c.codePointAt(0));
  const digit = d => String.fromCharCode(d + 22 + 75 * (d < 26));
  const adapt = (delta, numPoints, first) => {
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return k + Math.floor((base - tMin + 1) * delta / (delta + skew));
  };
  let out = cps.filter(c => c < 0x80).map(c => String.fromCharCode(c)).join('');
  const basic = out.length;
  let h = basic, n = 0x80, delta = 0, bias = 72;
  if (basic) out += '-';
  while (h < cps.length) {
    const m = Math.min(...cps.filter(c => c >= n));
    delta += (m - n) * (h + 1); n = m;
    for (const c of cps) {
      if (c < n) delta++;
      if (c !== n) continue;
      let q = delta;
      for (let k = base; ; k += base) {
        const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
        if (q < t) break;
        out += digit(t + (q - t) % (base - t));
        q = Math.floor((q - t) / (base - t));
      }
      out += digit(q);
      bias = adapt(delta, h + 1, h === basic);
      delta = 0; h++;
    }
    delta++; n++;
  }
  return out;
}

function toAsciiDomain(domain) {
  if (/^[\x00-\x7f]*$/.test(domain)) return domain;
  const labels = domain.normalize('NFC').split(/[.。．｡]/);
  return labels.map(l => /^[\x00-\x7f]*$/.test(l) ? l : 'xn--' + punycode(l)).join('.');
}

// Parse and normalise one address. Returns {error} or the parts.
export function parseEmail(raw) {
  const input = String(raw ?? '').trim().replace(/^mailto:/i, '').replace(/^<|>$/g, '');
  if (!input) return { input, error: 'Empty' };
  const at = input.lastIndexOf('@');
  if (at < 1 || at === input.length - 1) return { input, error: 'Missing @ or missing part' };
  const local = input.slice(0, at);
  const domainRaw = input.slice(at + 1).toLowerCase().replace(/\.$/, '');
  if (local.includes('@')) return { input, error: 'More than one @' };
  if (/\s/.test(input)) return { input, error: 'Contains spaces' };
  if (input.length > 254) return { input, error: 'Longer than 254 characters' };
  if (local.length > 64) return { input, error: 'Part before @ is longer than 64 characters' };

  const domain = toAsciiDomain(domainRaw);
  if (!domain) return { input, error: 'Domain is not a valid name' };
  const labels = domain.split('.');
  if (labels.length < 2) return { input, error: 'Domain has no extension (e.g. .com)' };
  if (!labels.every(l => LABEL_RE.test(l))) return { input, error: 'Domain is not a valid name' };
  if (!/^(xn--[a-z0-9-]+|[a-z]{2,63})$/.test(labels[labels.length - 1])) return { input, error: 'Domain extension is not valid' };

  const asciiLocal = /^[\x00-\x7f]*$/.test(local);
  if (asciiLocal && !LOCAL_RE.test(local)) return { input, error: 'Part before @ has characters or dots that are not allowed' };

  return { input, local, domain, domainDisplay: domainRaw, email: `${local.toLowerCase()}@${domain}`, unicodeLocal: !asciiLocal };
}

// Same-mailbox key: Gmail ignores dots and +tags; most providers ignore +tags.
function mailboxKey({ local, domain }) {
  let l = local.toLowerCase();
  const d = domain === 'googlemail.com' ? 'gmail.com' : domain;
  const plus = l.indexOf('+');
  if (plus > 0) l = l.slice(0, plus);
  if (d === 'gmail.com') l = l.replace(/\./g, '');
  return `${l}@${d}`;
}

export const DOH_URL = 'https://cloudflare-dns.com/dns-query';
export const dohUrl = (name, type) => `${DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`;

// Cloudflare DoH JSON -> {rcode, answers}. Pure, so Apps Script can reuse it with UrlFetchApp.
export function parseDohJson(j, type) {
  const typeNum = { MX: 15, A: 1, AAAA: 28 }[type];
  return { rcode: j.Status, answers: (j.Answer || []).filter(a => a.type === typeNum).map(a => a.data) };
}

// DNS over HTTPS (Cloudflare 1.1.1.1). Works in browsers (CORS), Workers and Node 18+.
export async function dohResolve(name, type, fetchImpl = fetch) {
  const res = await fetchImpl(dohUrl(name, type), { headers: { accept: 'application/dns-json' } });
  if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`);
  return parseDohJson(await res.json(), type);
}

// Turn the MX answer into domain info. Returns {needA: true} when the A fallback must be looked up.
export function domainInfoFromMx(mx) {
  if (mx.rcode === 3) return { exists: false };
  const hosts = mx.answers
    .map(d => { const [pref, host] = d.split(/\s+/); return { pref: +pref, host: (host || '').replace(/\.$/, '').toLowerCase() }; })
    .sort((a, b) => a.pref - b.pref);
  if (hosts.length === 1 && hosts[0].host === '') return { exists: true, nullMx: true, mx: [] };
  if (!hosts.length) return { needA: true };
  const top = hosts[0].host;
  const provider = PROVIDERS.find(([suffix]) => top === suffix || top.endsWith('.' + suffix))?.[1] || null;
  return { exists: true, mx: hosts.map(h => h.host), provider };
}

export function domainInfoFromA(a) {
  if (a.rcode === 3) return { exists: false };
  return { exists: true, mx: [], aFallback: a.answers.length > 0 };
}

// Look a domain up once: MX first, then A as the fallback delivery target.
export async function lookupDomain(domain, resolve = dohResolve) {
  try {
    const info = domainInfoFromMx(await resolve(domain, 'MX'));
    return info.needA ? domainInfoFromA(await resolve(domain, 'A')) : info;
  } catch (e) {
    return { error: e.message };
  }
}

export function makeDomainCache(resolve = dohResolve) {
  const cache = new Map();
  return domain => {
    if (!cache.has(domain)) cache.set(domain, lookupDomain(domain, resolve));
    return cache.get(domain);
  };
}

// Check one parsed address against its (cached) domain lookup.
export function evaluate(parsed, dns, disposable) {
  const r = {
    input: parsed.input, email: parsed.email || null, status: STATUS.UNCONFIRMED, reasons: [],
    flags: { disposable: false, role: false, free: false, duplicate: false, gateway: false },
    did_you_mean: null, provider: null, mx: null,
  };
  if (parsed.error) { r.status = STATUS.INVALID; r.reasons.push(parsed.error); return r; }

  const suggestion = suggestDomain(parsed.domain);
  if (suggestion) r.did_you_mean = `${parsed.local}@${suggestion}`;

  r.flags.role = ROLE.has(parsed.local.toLowerCase().split('+')[0]);
  r.flags.free = FREE.has(parsed.domain);
  // Match the domain or any parent (x.mailinator.com -> mailinator.com).
  const labels = parsed.domain.split('.');
  r.flags.disposable = labels.slice(0, -1).some((_, i) => disposable.has(labels.slice(i).join('.')));

  if (dns.error) {
    r.status = STATUS.RISKY; r.reasons.push(`Could not look up domain: ${dns.error}`);
  } else if (!dns.exists) {
    r.status = STATUS.INVALID; r.reasons.push('Domain does not exist');
  } else if (dns.nullMx) {
    r.status = STATUS.INVALID; r.reasons.push('Domain says it accepts no email (null MX)');
  } else if (!dns.mx.length && !dns.aFallback) {
    r.status = STATUS.INVALID; r.reasons.push('Domain has no mail server');
  } else {
    r.mx = dns.mx[0] || null;
    r.provider = dns.provider || null;
    r.flags.gateway = GATEWAYS.has(dns.provider);
    if (!dns.mx.length) { r.status = STATUS.RISKY; r.reasons.push('No MX record; mail would go to the website server'); }
  }

  if (r.status !== STATUS.INVALID) {
    if (r.flags.disposable) { r.status = STATUS.RISKY; r.reasons.push('Disposable (throwaway) email domain'); }
    if (suggestion) { r.status = STATUS.RISKY; r.reasons.push(`Looks like a typo of ${suggestion}`); }
    if (parsed.unicodeLocal) { r.status = STATUS.RISKY; r.reasons.push('Non-English characters before @; many servers reject these'); }
  } else if (suggestion) {
    r.reasons.push(`Did you mean ${suggestion}?`);
  }
  if (r.status === STATUS.UNCONFIRMED) r.reasons.push('Format and domain OK, mailbox not confirmed');
  if (r.flags.role && r.status !== STATUS.INVALID) r.reasons.push('Role address (shared inbox, lower reply rate)');
  return r;
}

// Check a list: look up each unique domain once, then evaluate.
export async function checkEmails(list, { disposable = new Set(), lookup = makeDomainCache(), concurrency = 8, onProgress } = {}) {
  const parsed = list.map(parseEmail);
  const domains = [...new Set(parsed.filter(p => !p.error).map(p => p.domain))];
  const dnsByDomain = new Map();
  let next = 0, done = 0;
  const worker = async () => {
    while (next < domains.length) {
      const d = domains[next++];
      dnsByDomain.set(d, await lookup(d));
      onProgress?.(++done, domains.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, domains.length) }, worker));

  return evaluateList(parsed, dnsByDomain, disposable);
}

// Sync core shared by every client: parsed addresses + domain info -> results.
// Duplicates (incl. Gmail dot/+tag variants) are flagged on the 2nd+ copy.
export function evaluateList(parsed, dnsByDomain, disposable) {
  const seen = new Map();
  return parsed.map(p => {
    const r = evaluate(p, p.error ? null : dnsByDomain.get(p.domain), disposable);
    if (!p.error) {
      const key = mailboxKey(p);
      const first = seen.get(key);
      if (first) {
        r.flags.duplicate = true;
        r.reasons.push(first.email === p.email ? `Duplicate of ${first.input}` : `Same inbox as ${first.input} (dots/+tag ignored)`);
      } else seen.set(key, p);
    }
    return r;
  });
}

export function summarize(results) {
  const s = { total: results.length, invalid: 0, risky: 0, unconfirmed: 0, duplicates: 0, disposable: 0, role: 0, free: 0, typos: 0 };
  // invalid + risky + duplicates + unconfirmed === total: a duplicate is only counted as a
  // duplicate when it would otherwise be unconfirmed, so "unconfirmed" = the clean, unique list.
  for (const r of results) {
    if (r.flags.duplicate && r.status === STATUS.UNCONFIRMED) s.duplicates++;
    else s[r.status]++;
    if (r.flags.disposable) s.disposable++;
    if (r.flags.role) s.role++;
    if (r.flags.free) s.free++;
    if (r.did_you_mean) s.typos++;
  }
  return s;
}
