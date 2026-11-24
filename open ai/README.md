# ChatGPT (OpenAI) Ads product feed — teslafire.com (US)

Product feed for OpenAI Ads Manager (US), built from the live WooCommerce catalog at https://teslafire.com.

## Links
- **Hosted URL for Ads Manager (recommended):** https://data.teslafire.com/open%20ai/teslafire_openai_feed.tsv
- Manual upload (Upload CSV or TXT): `teslafire_openai_feed.txt` (tab-delimited) or `teslafire_openai_feed.csv`
- TXT: https://data.teslafire.com/open%20ai/teslafire_openai_feed.txt
- CSV: https://data.teslafire.com/open%20ai/teslafire_openai_feed.csv
- JSONL (SFTP / API): https://data.teslafire.com/open%20ai/teslafire_openai_feed.jsonl

## Feed settings
- 153 products, seller `Tesla Fire Systems LLC`
- Market: `target_countries: ["US"]`, `store_country: "US"`, prices in USD
- `is_eligible_search: true`, `is_ads_eligible: true` on every row
- `item_id` = WooCommerce product ID (stable)
- `gtin` / `mpn` carried over from the Google feed (`google-merchant-feed-llc.csv`) where they match; only GTINs with a valid check digit are included
- Products with no brand on the site use `Tesla Fire Systems` as the brand
- Return policy: https://teslafire.com/refund_returns/ · Privacy: https://teslafire.com/privacy-policy/

## Upload
Ads Manager → Tools → Feeds → open the feed's ⋮ menu:
- **Hosted URL** (best — Ads Manager re-fetches it, and this repo rebuilds it daily): paste `https://data.teslafire.com/open%20ai/teslafire_openai_feed.tsv`
- **Upload CSV or TXT**: upload `teslafire_openai_feed.txt` (or `.csv`)

Ads Manager does not accept the `.jsonl` file in its upload box; JSONL is for SFTP/API delivery only.

Spec: https://developers.openai.com/commerce/specs/file-upload/products
