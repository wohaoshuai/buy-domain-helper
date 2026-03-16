<!--skill-metadata
name: cloudflare-pages-skill
description: |
  Buy a domain, deploy a site to Cloudflare Pages, and link the custom domain —
  full Cloudflare setup from inside your AI agent.

  Trigger conditions:
  - User wants to launch a site or landing page
  - User wants to buy or register a domain
  - User wants to connect a custom domain to a Cloudflare Pages project
  - User says: "buy a domain", "deploy my page", "link my domain", "set up cloudflare"

  Prerequisites: Cloudflare account, CF_API_TOKEN
  Response principle: Ask for confirmation before any purchase. Show the live URL as soon as it's ready.
  Language: Match the user's language throughout.
-->

# Cloudflare Pages Skill

> Core tool: `node cf.js <command> --token <token> --account <account-id>`
> The agent handles the full workflow. The script only calls the Cloudflare API.

## Install

```bash
# Via skills CLI (Claude Code, Cursor, Copilot, and 38+ agents)
npx skills add wohaoshuai/cloudflare-pages-skill

# Via OpenClaw
clawhub install cloudflare-pages-skill
```

---

## Step 1 — Register & Buy a Domain

**Ask the user:**
```
What domain name do you want? (e.g. mysite.com, my-app.io)
```

Once they provide a name:

1. Check if it's available:
   ```bash
   node cf.js domain-check <domain> --token <token> --account <account-id>
   ```

2. If **not available**, suggest 2–3 alternatives (e.g. different TLDs: `.io`, `.cc`, `.ai`).

3. If **available**, tell the user the price and ask for confirmation:
   ```
   ✅ mysite.com is available for $9.15/year via Cloudflare Registrar.

   To purchase, go to:
   https://dash.cloudflare.com/<account-id>/domains/register?search=mysite.com

   Complete the purchase in your browser, then come back and I'll finish the setup.
   ```

4. Wait for the user to confirm they've completed the purchase before proceeding.

> **Note:** Cloudflare Registrar does not expose a purchase API — the user must complete the purchase in the browser. Registration typically takes 1–2 minutes to activate.

---

## Step 2 — Request DNS Permission

Once the domain is registered (or if the user already owns it), ask:

```
To link your domain automatically, I need a Cloudflare API token with DNS edit permission.

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token" → "Custom token"
3. Add permission: Zone → DNS → Edit
4. Set Zone Resources: <domain>
5. Create and paste the token here.
```

Store the token as `DNS_TOKEN` for use in Step 3.

Also confirm their **Account ID** (visible at the bottom-right of the Cloudflare dashboard overview page).

---

## Step 3 — Deploy Example Page & Link Domain

### 3a. Get the zone ID
```bash
node cf.js zone <domain> --token <DNS_TOKEN>
# → {"zone_id": "abc123...", "name": "mysite.com", "status": "active"}
```

### 3b. Create the Pages project
```bash
node cf.js pages-create <project-name> --token <PAGES_TOKEN> --account <account-id>
# → {"name": "mysite", "subdomain": "mysite.pages.dev"}
```

Use the domain name (without TLD) as the project name, e.g. `mysite` for `mysite.com`.

### 3c. Build an example page

Create a minimal `index.html` in `/tmp/<project-name>/`:
- Use the domain name as the site title
- Include a brief "coming soon" or placeholder message
- Keep it clean and dark-themed

### 3d. Deploy the page
```bash
node cf.js pages-deploy <project-name> /tmp/<project-name> --token <PAGES_TOKEN> --account <account-id>
# → {"url": "https://abc123.mysite.pages.dev", "project": "mysite"}
```

### 3e. Attach the custom domain
```bash
node cf.js pages-domain <project-name> <domain> --token <PAGES_TOKEN> --account <account-id>
# → {"domain": "mysite.com", "status": "initializing"}
```

### 3f. Add the CNAME record
```bash
node cf.js dns-cname <zone-id> @ <project-name>.pages.dev --token <DNS_TOKEN>
# → {"name": "mysite.com", "content": "mysite.pages.dev", "proxied": true}
```

### 3g. Verify it's live
```bash
curl -sI https://<domain> | head -2
# HTTP/2 200 ✅
```

---

## Step 4 — Present Results

```
━━━━━━━━━━━━━━━━━━━━━━━━
☁️  Your site is live!

🌐 https://<domain>
📁 Pages project: <project-name>.pages.dev
━━━━━━━━━━━━━━━━━━━━━━━━
Next steps:
- Replace /tmp/<project-name>/index.html with your real content
- Run: node cf.js pages-deploy <project-name> <dir> --token ...
- Your domain will automatically serve the updated page
```

---

## Error Handling

| Situation | Response |
|-----------|----------|
| Domain not in account yet | Ask user to complete purchase in browser and confirm |
| `zone_id: null` | Domain not yet active — wait 1–2 min and retry `cf.js zone` |
| DNS token auth error | Ask user to regenerate token with correct Zone > DNS > Edit permission |
| Pages project name taken | Append `-site` or `-app` to the project name |
| `HTTP 522` after deploy | SSL cert still provisioning — wait 30s and retry |

---

## Token Reference

| Token type | Permission | Where to create |
|-----------|-----------|----------------|
| Pages token | Account > Cloudflare Pages > Edit | dash.cloudflare.com/profile/api-tokens |
| DNS token | Zone > DNS > Edit (specific zone) | dash.cloudflare.com/profile/api-tokens |

The wrangler OAuth token (`wrangler login`) covers Pages but **not** DNS edit. Always ask for a separate custom DNS token.
