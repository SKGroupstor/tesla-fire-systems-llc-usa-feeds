# Tesla Fire Systems LLC — United States product feeds

**Entity:** Tesla Fire Systems LLC (United States) · **Store:** https://teslafire.com · **Feeds served at:** https://data.teslafire.com

This repo holds the US feeds for Google Merchant Center and ChatGPT (OpenAI) Ads. The Canadian feeds for Tesla Fire Systems Inc (teslafiresystems.com) live in a separate repo: [SKGroupstor/tesla-fire-systems-inc-canada-feeds](https://github.com/SKGroupstor/tesla-fire-systems-inc-canada-feeds).

## Feeds

| Feed | Platform | File | Public URL |
|---|---|---|---|
| Primary product feed | Google Merchant Center | `google-merchant-feed-llc.csv` | https://data.teslafire.com/google-merchant-feed-llc.csv |
| Product feed (upload file) | ChatGPT (OpenAI) Ads | `open ai/teslafire_openai_feed.jsonl` | https://data.teslafire.com/open%20ai/teslafire_openai_feed.jsonl |
| Product feed (review copy) | ChatGPT (OpenAI) Ads | `open ai/teslafire_openai_feed.csv` | https://data.teslafire.com/open%20ai/teslafire_openai_feed.csv |

Raw fallback URLs (if GitHub Pages is ever down): replace `https://data.teslafire.com/` with `https://raw.githubusercontent.com/SKGroupstor/tesla-fire-systems-llc-usa-feeds/main/`.

### Google Merchant Center
- The LLC has no store plugin feed, so the full primary feed (120 products: title, description, price, GTIN, shipping weight, etc.) is built and hosted here. Refresh it by pushing an updated CSV.
- Register the URL above as the scheduled-fetch URL in Merchant Center.

### ChatGPT (OpenAI) Ads
- 153 products, prices in USD, `target_countries: ["US"]`, seller Tesla Fire Systems LLC.
- OpenAI Ads Manager takes the feed by **SFTP upload** (Tools → Feeds → Create Feed). The URLs are for download and reference.
- Feed settings and notes: [`open ai/README.md`](open%20ai/README.md).

## Hosting
- GitHub Pages from the `main` branch root, custom domain `data.teslafire.com` (set by the `CNAME` file).
- DNS (Hostinger): `CNAME data → skgroupstor.github.io`.
- Anything pushed to `main` is live within moments.

## Layout
```
├── CNAME                                  data.teslafire.com
├── google-merchant-feed-llc.csv           Google primary product feed (120 rows)
├── open ai/                               ChatGPT (OpenAI) Ads feed (153 products, USD)
├── backups/                               dated snapshots of the LLC feed
└── .github/workflows/backup-on-update.yml backs up the pre-push version of any modified file into backups/
```

Moved here from `SKGroupstor/tesla-merchant-centre` on 2026-11-22.
