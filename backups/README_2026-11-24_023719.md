# ChatGPT (OpenAI) Ads product feed — teslafire.com (US)

Product feed for OpenAI Ads Manager (US), built from the live WooCommerce catalog at https://teslafire.com.

## Links
- JSONL (upload file): https://data.teslafire.com/open%20ai/teslafire_openai_feed.jsonl
- CSV (review copy): https://data.teslafire.com/open%20ai/teslafire_openai_feed.csv
- Raw fallback: https://raw.githubusercontent.com/SKGroupstor/tesla-fire-systems-llc-usa-feeds/main/open%20ai/teslafire_openai_feed.jsonl

## Feed settings
- 153 products, seller `Tesla Fire Systems LLC`
- Market: `target_countries: ["US"]`, `store_country: "US"`, prices in USD
- `is_eligible_search: true`, `is_ads_eligible: true` on every row
- `item_id` = WooCommerce product ID (stable)
- `gtin` / `mpn` carried over from the Google feed (`google-merchant-feed-llc.csv`) where they match; only GTINs with a valid check digit are included
- Products with no brand on the site use `Tesla Fire Systems` as the brand
- Return policy: https://teslafire.com/refund_returns/ · Privacy: https://teslafire.com/privacy-policy/

## Upload
Ads Manager → Tools → Feeds → Create Feed → connect via SFTP → upload the `.jsonl` file.
OpenAI treats each upload as the full catalog; refresh at least daily.

Spec: https://developers.openai.com/commerce/specs/file-upload/products
