#!/usr/bin/env node
/**
 * cf.js — Cloudflare Pages + DNS helper (zero dependencies)
 *
 * Commands:
 *   node cf.js zone <domain>                          → {zone_id, name, status}
 *   node cf.js pages-create <project-name>            → {name, subdomain}
 *   node cf.js pages-deploy <project-name> <dir>      → {url}
 *   node cf.js pages-domain <project-name> <domain>   → {status}
 *   node cf.js dns-cname <zone-id> <name> <target>    → {id, name, content}
 *   node cf.js domain-check <domain>                  → {available, price}
 *
 * Required flags:
 *   --token   <CF_API_TOKEN>    Cloudflare API token
 *   --account <CF_ACCOUNT_ID>  Cloudflare account ID
 *
 * Or set env vars: CF_API_TOKEN, CF_ACCOUNT_ID
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const BASE = 'https://api.cloudflare.com/client/v4';

function parseFlags(args) {
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      flags[key] = val;
    } else { flags._.push(args[i]); }
  }
  return flags;
}

const [,, cmd, ...rawArgs] = process.argv;
const flags = parseFlags(rawArgs);

const TOKEN   = flags.token   ?? process.env.CF_API_TOKEN;
const ACCOUNT = flags.account ?? process.env.CF_ACCOUNT_ID;

if (!TOKEN)   { process.stderr.write('Error: --token <CF_API_TOKEN> required\n'); process.exit(1); }
if (!ACCOUNT && cmd !== 'zone' && cmd !== 'domain-check') {
  process.stderr.write('Error: --account <CF_ACCOUNT_ID> required\n'); process.exit(1);
}

const log = msg => process.stderr.write(msg + '\n');
const out = data => console.log(JSON.stringify(data));

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json.errors));
  return json.result;
}

// ── zone ──────────────────────────────────────────────────────────────────────
if (cmd === 'zone') {
  const domain = flags._[0];
  if (!domain) throw new Error('Usage: cf.js zone <domain>');
  log(`🔍 Looking up zone for ${domain}...`);
  const zones = await api('GET', `/zones?name=${domain}`);
  if (!zones.length) { out({ zone_id: null, error: 'Zone not found in this account' }); process.exit(0); }
  const z = zones[0];
  out({ zone_id: z.id, name: z.name, status: z.status });
}

// ── pages-create ──────────────────────────────────────────────────────────────
else if (cmd === 'pages-create') {
  const name = flags._[0];
  if (!name) throw new Error('Usage: cf.js pages-create <project-name>');
  log(`📁 Creating Pages project: ${name}...`);
  const result = await api('POST', `/accounts/${ACCOUNT}/pages/projects`, {
    name,
    production_branch: 'main',
  });
  out({ name: result.name, subdomain: result.subdomain });
}

// ── pages-deploy ──────────────────────────────────────────────────────────────
else if (cmd === 'pages-deploy') {
  const [projectName, dir] = flags._;
  if (!projectName || !dir) throw new Error('Usage: cf.js pages-deploy <project-name> <dir>');

  log(`🚀 Deploying ${dir} to ${projectName}...`);

  // Build multipart form with all files
  const absDir = resolve(dir);
  const files = [];
  function walk(d) {
    for (const f of readdirSync(d)) {
      const full = join(d, f);
      if (statSync(full).isDirectory()) { walk(full); }
      else { files.push({ path: full.replace(absDir + '/', ''), content: readFileSync(full) }); }
    }
  }
  walk(absDir);

  // Use wrangler under the hood for actual upload (wrangler handles multipart)
  const { execSync } = await import('node:child_process');
  const env = { ...process.env, CF_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
  const result = execSync(
    `wrangler pages deploy "${absDir}" --project-name "${projectName}" --branch main 2>&1`,
    { env }
  ).toString();

  const urlMatch = result.match(/https:\/\/[^\s]+\.pages\.dev/);
  const url = urlMatch ? urlMatch[0] : null;
  log(result);
  out({ url, project: projectName });
}

// ── pages-domain ──────────────────────────────────────────────────────────────
else if (cmd === 'pages-domain') {
  const [projectName, domain] = flags._;
  if (!projectName || !domain) throw new Error('Usage: cf.js pages-domain <project-name> <domain>');
  log(`🔗 Attaching ${domain} to ${projectName}...`);
  const result = await api('POST', `/accounts/${ACCOUNT}/pages/projects/${projectName}/domains`, {
    name: domain,
  });
  out({ domain: result.name, status: result.status });
}

// ── dns-cname ─────────────────────────────────────────────────────────────────
else if (cmd === 'dns-cname') {
  const [zoneId, name, target] = flags._;
  if (!zoneId || !name || !target) throw new Error('Usage: cf.js dns-cname <zone-id> <name> <target>');
  log(`📡 Adding CNAME: ${name} → ${target}...`);
  const result = await api('POST', `/zones/${zoneId}/dns_records`, {
    type: 'CNAME',
    name,
    content: target,
    proxied: true,
  });
  out({ id: result.id, name: result.name, content: result.content, proxied: result.proxied });
}

// ── domain-check ──────────────────────────────────────────────────────────────
else if (cmd === 'domain-check') {
  const domain = flags._[0];
  if (!domain) throw new Error('Usage: cf.js domain-check <domain>');
  log(`🔍 Checking availability of ${domain}...`);
  const result = await api('GET', `/accounts/${ACCOUNT}/registrar/domains/${domain}`);
  out({ available: result.available, name: result.name, price: result.current_registrar });
}

else {
  process.stderr.write(`Unknown command: ${cmd}\n`);
  process.stderr.write('Commands: zone, pages-create, pages-deploy, pages-domain, dns-cname, domain-check\n');
  process.exit(1);
}
