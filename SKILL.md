---
name: cloudflare-pages-skill
description: Buy a domain, deploy an example site to Cloudflare Pages, and link the domain — full setup from inside your AI agent. Use when the user wants to launch a site, register a domain on Cloudflare, or connect a custom domain to a Pages project.
version: 1.0.0
metadata:
  openclaw:
    requires:
      env: []
      bins:
        - node
        - wrangler
    emoji: "☁️"
    homepage: https://github.com/wohaoshuai/cloudflare-pages-skill
---

# Cloudflare Pages Skill

Full site setup in three steps: buy domain → deploy page → link domain.

## Helper script

```bash
node cf.js <command> --token <CF_API_TOKEN> --account <CF_ACCOUNT_ID> [args]
```

Commands:
| Command | Description |
|---------|-------------|
| `zone <domain>` | Get zone ID for a domain already in Cloudflare |
| `pages-create <name>` | Create a new Pages project |
| `pages-deploy <name> <dir>` | Deploy a local directory to Pages |
| `pages-domain <project> <domain>` | Attach a custom domain to a Pages project |
| `dns-cname <zone-id> <name> <target>` | Add a proxied CNAME DNS record |
| `domain-check <domain>` | Check if a domain is available via Cloudflare Registrar |

## Setup

Requires a Cloudflare API token. Two tokens may be needed:

| Token | Permissions needed | Used for |
|-------|-------------------|----------|
| **Pages token** | Account > Pages > Edit | Create projects, deploy |
| **DNS token** | Zone > DNS > Edit | Add CNAME records |

Create tokens at: https://dash.cloudflare.com/profile/api-tokens
