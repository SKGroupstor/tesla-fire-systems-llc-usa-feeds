#!/usr/bin/env node
// Rebuilds every product feed in this repo from the store's live WooCommerce catalog.
//
// Reads the public WooCommerce Store API (no keys needed), then writes:
//   - the ChatGPT (OpenAI) Ads feed:   open ai/<name>.jsonl and .csv
//   - the Google Merchant Center feed: local inventory (Canada) or primary product feed (US)
//
// Files are only rewritten when their content changes, so a run with no store changes
// leaves the repo untouched. feed-status.json records when feeds last changed and when
// the last weekly refresh ran (FORCE=1).
//
// Usage: node scripts/build-feeds.mjs            (config from feeds.config.json)
//        FORCE=1 node scripts/build-feeds.mjs    (weekly refresh: always stamps feed-status.json)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CONFIG = JSON.parse(readFileSync('feeds.config.json', 'utf8'));
const FORCE = process.env.FORCE === '1';
const STATUS_FILE = 'feed-status.json';
const UA = 'Mozilla/5.0 (compatible; TeslaFireFeedBot/1.0; +https://github.com/SKGroupstor)';

// ---------- helpers ----------
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', prime: '′', Prime: '″', reg: '®', trade: '™', copy: '©',
  deg: '°', times: '×', frac12: '½', frac14: '¼', frac34: '¾', eacute: 'é', egrave: 'è', ecirc: 'ê',
  agrave: 'à', ccedil: 'ç', ocirc: 'ô', icirc: 'î', uuml: 'ü', ouml: 'ö', sup2: '²', middot: '·', bull: '•' };
const decode = (s = '') => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&([a-z0-9]+);/gi, (m, n) => (n in NAMED ? NAMED[n] : m));
// U+2028/2029, NEL, VT, FF break line-based readers (JSONL, Notepad); turn them into spaces.
const SEP = /[\u{2028}\u{2029}\u{85}\u{0B}\u{0C}]/gu;
const stripHtml = (h = '') => decode(
  h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|li|h\d|div|tr)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
  .replace(SEP, ' ').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
const cleanTitle = (s) => decode(s).replace(SEP, ' ').replace(/\[\[|\]\]/g, '').replace(/\s{2,}/g, ' ').trim();
const money = (minor, unit, cur) => (Number(minor) / 10 ** unit).toFixed(2) + ' ' + cur;
const pathOf = (u) => { try { return new URL(u).pathname.replace(/\/?$/, '/'); } catch { return ''; } };
const directImage = (src, base) => { const m = (src || '').match(/wp-content\/uploads\/([^?]+)/); return m ? `${base}/wp-content/uploads/${m[1]}` : src; };
const jpgOrPng = (u) => /\.(jpe?g|png)$/i.test(u);
const attr = (p, name) => decode((p.attributes || []).find((a) => a.name.toLowerCase() === name)?.terms?.map((t) => t.name).join(', ') || '');
const validGtin = (g) => {
  if (!/^(\d{8}|\d{12,14})$/.test(g || '')) return false;
  const d = g.split('').map(Number); const check = d.pop();
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === check;
};

// CSV
const csvCell = (v) => { if (v == null) return ''; v = Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? String(v) : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const toCsv = (cols, rows) => '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f.replace(/\r$/, '')); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0]);
  return { cols: head, rows: body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))) };
}

const changed = [];
function writeIfChanged(file, content) {
  const norm = (s) => s.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  if (existsSync(file) && norm(readFileSync(file, 'utf8')) === norm(content)) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  changed.push(file);
  return true;
}

// ---------- fetch catalog ----------
async function fetchCatalog(base) {
  const all = [];
  for (let page = 1; page < 50; page++) {
    const url = `${base}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) break;
      console.warn(`  ${url} -> HTTP ${res.status} (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
    if (!res.ok) throw new Error(`Store API failed: ${url} HTTP ${res.status}`);
    const batch = await res.json();
    all.push(...batch);
    const total = Number(res.headers.get('x-wp-totalpages') || 0);
    if (batch.length < 100 || (total && page >= total)) break;
  }
  return all.filter((p) => p.type !== 'variation');
}

// ---------- brand ----------
const BRAND_FROM_TITLE = [[/^aimlite/i, 'AimLite'], [/^amerex/i, 'Amerex'], [/^kidde/i, 'Kidde'], [/^(mircom|microm)\b/i, 'Mircom'],
  [/^edwards/i, 'Edwards'], [/^system sensor/i, 'System Sensor'], [/^ansul/i, 'Ansul'], [/^first alert/i, 'First Alert'], [/^sti-|\bSTI\d/i, 'STI']];
const BRAND_FIX = { Kiddle: 'Kidde' };
function brandOf(p, title, fallback) {
  let b = decode((p.brands || [])[0]?.name || attr(p, 'brand'));
  b = BRAND_FIX[b] || b;
  if (!b) b = BRAND_FROM_TITLE.find(([re]) => re.test(title))?.[1] || '';
  return b || fallback;
}

// ---------- normalize one product ----------
function normalize(p, cfg) {
  const pr = p.prices; const unit = pr.currency_minor_unit; const cur = pr.currency_code;
  const title = cleanTitle(p.name);
  let desc = stripHtml(p.description);
  if (desc.length < 60) desc = stripHtml(p.short_description) || desc;
  desc = desc.replace(/\[\[|\]\]/g, '');
  if (desc.length > 1500) desc = desc.slice(0, 1500).replace(/\s\S*$/, '') + '…';
  if (!desc) desc = `${title} from Tesla Fire Systems.`;
  const imgs = (p.images || []).slice(0, 6).map((i) => directImage(i.src, cfg.store));
  const j = imgs.findIndex(jpgOrPng); if (j > 0) [imgs[0], imgs[j]] = [imgs[j], imgs[0]];
  const reg = Number(pr.regular_price), sale = Number(pr.sale_price);
  const brand = brandOf(p, title, cfg.fallbackBrand);
  const cats = (p.categories || []).map((c) => decode(c.name));
  return {
    id: p.id, sku: p.sku || '', title, desc, url: cfg.store + pathOf(p.permalink), path: pathOf(p.permalink), imgs, brand,
    cur, regular: reg > 0 ? money(reg, unit, cur) : '', sale: p.on_sale && sale > 0 && sale < reg ? money(sale, unit, cur) : '',
    status: p.is_on_backorder ? 'backorder' : p.is_in_stock ? 'in_stock' : 'out_of_stock',
    category: cats.find((c) => !/[éèêîôçà]/i.test(c) && c !== brand) || cats[0] || '',
    material: attr(p, 'material'), color: attr(p, 'color'),
    weightLb: p.weight && /lb/i.test(p.formatted_weight || '') ? `${p.weight} lb` : '',
  };
}

// ---------- OpenAI feed ----------
const OPENAI_COLS = ['item_id', 'title', 'description', 'url', 'brand', 'seller_name', 'image_url', 'additional_image_urls', 'price', 'sale_price',
  'availability', 'condition', 'gtin', 'mpn', 'product_category', 'material', 'color', 'target_countries', 'store_country', 'seller_url',
  'return_policy', 'seller_privacy_policy', 'is_eligible_search', 'is_ads_eligible'];
function buildOpenAI(items, cfg, ids) {
  const rows = [];
  for (const it of items) {
    if (!it.regular || !it.imgs.length) continue; // OpenAI needs a price > 0 and an image
    const o = { item_id: String(it.id), title: it.title.length > 150 ? it.title.slice(0, 147) + '...' : it.title, description: it.desc,
      url: it.url, brand: it.brand, seller_name: cfg.sellerName, image_url: it.imgs[0], price: it.regular, availability: it.status,
      target_countries: [cfg.country], store_country: cfg.country };
    if (it.sale) o.sale_price = it.sale;
    if (it.imgs.length > 1) o.additional_image_urls = it.imgs.slice(1);
    o.condition = 'new';
    const idf = ids[it.path];
    if (idf?.gtin && validGtin(idf.gtin)) o.gtin = idf.gtin;
    if (idf?.mpn) o.mpn = idf.mpn;
    if (it.category) o.product_category = 'Fire Safety > ' + it.category;
    if (it.material) o.material = it.material;
    if (it.color) o.color = it.color;
    Object.assign(o, { seller_url: cfg.store, return_policy: cfg.store + '/refund_returns/', seller_privacy_policy: cfg.store + '/privacy-policy/',
      is_eligible_search: true, is_ads_eligible: true });
    rows.push(o);
  }
  rows.sort((a, b) => Number(b.item_id) - Number(a.item_id));
  return rows;
}

// ---------- Google local inventory (Canada) ----------
// Keeps the curated product list and per-row pickup settings; refreshes price, sale price,
// availability, name and URL from the store. Products deleted from the store are dropped.
// Products published after the first automated run (not in state.knownIds) are added.
function buildLocalInventory(items, g, state) {
  const { cols, rows } = parseCsv(readFileSync(g.file, 'utf8'));
  const byId = new Map(items.map((it) => [String(it.id), it]));
  const out = []; const seen = new Set();
  for (const r of rows) {
    const pid = r.id.replace(/^gla_/, '');
    const it = byId.get(pid);
    if (!it || !it.regular) continue;
    seen.add(pid);
    out.push({ ...r, availability: it.status === 'in_stock' ? 'in_stock' : 'out_of_stock', price: it.regular, sale_price: it.sale,
      sku_reference: it.sku || '(no SKU)', product_name_reference: it.title, product_url_reference: it.url });
  }
  for (const it of items) {
    const pid = String(it.id);
    if (seen.has(pid) || state.knownIds.includes(pid) || !it.regular) continue;
    out.push({ id: `gla_${pid}`, store_code: g.defaults.store_code, quantity: g.defaults.quantity,
      availability: it.status === 'in_stock' ? 'in_stock' : 'out_of_stock', pickup_method: g.defaults.pickup_method,
      pickup_sla: g.defaults.pickup_sla, price: it.regular, sale_price: it.sale, sku_reference: it.sku || '(no SKU)',
      product_name_reference: it.title, product_url_reference: it.url });
  }
  return { cols, rows: out };
}

// ---------- Google primary product feed (US) ----------
// Keeps each row's id, gtin, mpn and identifier_exists; refreshes everything else from the store.
function buildPrimary(items, g, state) {
  const { cols, rows } = parseCsv(readFileSync(g.file, 'utf8'));
  const byPath = new Map(items.map((it) => [it.path, it]));
  const out = []; const seen = new Set();
  const fill = (base, it) => ({ ...base, title: it.title.slice(0, 150), description: it.desc, link: it.url, image_link: it.imgs[0] || base.image_link,
    availability: it.status === 'backorder' ? 'backorder' : it.status, price: it.regular, sale_price: it.sale, brand: it.brand,
    condition: 'new', shipping_weight: it.weightLb || base.shipping_weight });
  for (const r of rows) {
    const it = byPath.get(pathOf(r.link));
    if (!it || !it.regular || !it.imgs.length) continue;
    seen.add(it.path);
    out.push(fill(r, it));
  }
  for (const it of items) {
    if (seen.has(it.path) || state.knownIds.includes(String(it.id)) || !it.regular || !it.imgs.length) continue;
    out.push(fill({ id: it.sku || String(it.id), gtin: '', mpn: it.sku || '', identifier_exists: it.sku ? '' : 'no' }, it));
  }
  return { cols, rows: out };
}

// identifiers (gtin/mpn) by product path, taken from the Google feed when it has them
function identifiersFromGoogle(g) {
  if (!g || g.type !== 'primary' || !existsSync(g.file)) return {};
  const { rows } = parseCsv(readFileSync(g.file, 'utf8'));
  return Object.fromEntries(rows.map((r) => [pathOf(r.link), { gtin: r.gtin, mpn: r.mpn }]));
}

// ---------- main ----------
const status = existsSync(STATUS_FILE) ? JSON.parse(readFileSync(STATUS_FILE, 'utf8')) : {};
const state = { knownIds: status.known_product_ids || null };

console.log(`Fetching ${CONFIG.store} catalog...`);
const raw = await fetchCatalog(CONFIG.store);
const items = raw.map((p) => normalize(p, CONFIG));
console.log(`  ${items.length} products`);
if (items.length < (CONFIG.minProducts || 1)) throw new Error(`Only ${items.length} products returned; refusing to overwrite feeds.`);
// First automated run: treat today's catalog as the curated baseline (nothing gets auto-added).
if (!state.knownIds) state.knownIds = items.map((it) => String(it.id));

const g = CONFIG.google;
if (g) {
  const built = g.type === 'local_inventory' ? buildLocalInventory(items, g, state) : buildPrimary(items, g, state);
  writeIfChanged(g.file, toCsv(built.cols, built.rows));
  console.log(`  Google ${g.type}: ${built.rows.length} rows`);
}
const ids = identifiersFromGoogle(g);
const oa = buildOpenAI(items, CONFIG, ids);
writeIfChanged(CONFIG.openai.jsonl, oa.map((o) => JSON.stringify(o)).join('\n') + '\n');
writeIfChanged(CONFIG.openai.csv, toCsv(OPENAI_COLS, oa.map((o) => ({ ...o }))));
console.log(`  OpenAI: ${oa.length} products`);

// Every product id now in the store becomes "known", so new products are only added once.
const known = [...new Set([...state.knownIds, ...items.map((it) => String(it.id))])].sort((a, b) => a - b);
const now = new Date().toISOString();
const next = {
  store: CONFIG.store,
  last_change: changed.length ? now : status.last_change || null,
  last_weekly_refresh: FORCE ? now : status.last_weekly_refresh || null,
  last_changed_files: changed.length ? changed : status.last_changed_files || [],
  products_in_store: items.length,
  openai_products: oa.length,
  known_product_ids: known,
};
const statusChanged = changed.length || FORCE || JSON.stringify(known) !== JSON.stringify(status.known_product_ids || []);
if (statusChanged) writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2) + '\n');
console.log(changed.length ? `Changed: ${changed.join(', ')}` : 'No feed changes.');
