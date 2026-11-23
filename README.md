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

## Automatic updates

All feeds in this repo rebuild themselves from the live store. Nothing needs to be uploaded by hand.

| When | What happens |
|---|---|
| **Daily**, three checks (~3:17 AM, ~10:17 AM, ~4:17 PM Toronto) | Crawls the store's public catalog (WooCommerce Store API) and rebuilds every feed. If anything changed (price, sale price, stock, title, description, images, new or removed products) the feeds are committed and republished. If nothing changed, nothing is committed. |
| **Weekly** (Mondays ~4:41 AM Toronto) | Forced refresh. Rebuilds and republishes the feeds and stamps `feed-status.json` even if nothing changed. |
| **On demand** | Actions tab → *Update feeds* → *Run workflow* (tick *force* for a weekly-style refresh). |

- Code: `scripts/build-feeds.mjs` (Node 20, no dependencies), settings: `feeds.config.json`, workflow: `.github/workflows/update-feeds.yml`.
- `feed-status.json` shows when the feeds last changed, the last weekly refresh, and product counts.
- Google feed rows keep their curated settings (ids, pickup settings, GTIN/MPN); prices, stock and text come from the store. Products deleted from the store are removed; products published after 2026-11-22 are added automatically.
- If the store returns fewer than 50 products (outage, block), the run stops without touching the feeds.
- Every automated change is a commit, so any earlier version can be restored from the git history.

## Hosting
- GitHub Pages from the `main` branch root, custom domain `data.teslafire.com` (set by the `CNAME` file).
- DNS (Hostinger): `CNAME data → skgroupstor.github.io`.
- Anything pushed to `main` is live within moments.

## Layout
```
├── CNAME                                  data.teslafire.com
├── google-merchant-feed-llc.csv           Google primary product feed (120 rows)
├── open ai/                               ChatGPT (OpenAI) Ads feed (153 products, USD)
├── scripts/build-feeds.mjs                rebuilds all feeds from the live store
├── feeds.config.json                      store, country, seller and feed file settings
├── feed-status.json                       last change / last weekly refresh / product counts
├── backups/                               dated snapshots of the LLC feed
└── .github/workflows/
    ├── update-feeds.yml                   daily crawl + weekly refresh
    ├── publish-gh-pages.yml               mirrors main to gh-pages (the Pages branch)
    └── backup-on-update.yml               backs up the pre-push version of hand-edited files into backups/
```

Moved here from `SKGroupstor/tesla-merchant-centre` on 2026-11-22.
