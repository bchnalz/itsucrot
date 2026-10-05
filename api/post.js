// Halaman postingan dengan judul & ringkasan sudah tertanam di HTML,
// supaya WhatsApp / Telegram / Facebook menampilkan pratinjau (judul, deskripsi, gambar)
// saat link /post?id=... dibagikan. Aplikasi chat tidak menjalankan JavaScript,
// jadi metadata ini harus dikirim dari server.
const fs = require("fs");
const path = require("path");

let TEMPLATE = null;
let CONFIG = null;

function read(rel) {
  try { return fs.readFileSync(path.join(process.cwd(), rel), "utf8"); } catch { return null; }
}

function template() {
  if (TEMPLATE == null) TEMPLATE = read("post.html") || "<!doctype html><title>Pusat Solusi IT</title>";
  return TEMPLATE;
}

function config() {
  if (CONFIG) return CONFIG;
  const env = process.env;
  const pick = (...n) => n.map((k) => env[k]).find((v) => v && v.trim()) || "";
  let url = pick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL");
  let key = pick("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_KEY", "SUPABASE_PUBLISHABLE_KEY");
  let siteName = pick("SITE_NAME");
  if (!url || !key) {
    // Cadangan: ambil dari config.js hasil build
    const src = read("dist/config.js") || read("config.js") || "";
    const m = src.match(/window\.APP_CONFIG\s*=\s*(\{[\s\S]*?\});/);
    if (m) {
      try {
        const c = JSON.parse(m[1]);
        url = url || c.SUPABASE_URL; key = key || c.SUPABASE_ANON_KEY; siteName = siteName || c.SITE_NAME;
      } catch { /* config.js bukan JSON murni (versi contoh) */ }
    }
  }
  if (url && /XXXX/.test(url)) url = "";
  CONFIG = { url: (url || "").replace(/\/+$/, ""), key, siteName: siteName || "Pusat Solusi IT" };
  return CONFIG;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { solusi: "Solusi", software: "Software", panduan: "Panduan" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchPost(id) {
  const { url, key } = config();
  if (!url || !key || !UUID.test(id)) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(
      `${url}/rest/v1/posts?id=eq.${id}&published=eq.true&select=title,summary,content,code,category,kind&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: ctrl.signal }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return rows[0] || null;
  } catch { return null; } finally { clearTimeout(t); }
}

module.exports = async (req, res) => {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const site = `https://${host}`;
  const id = String((req.query && req.query.id) || "");
  const { siteName } = config();

  let html = template().split("%SITE_URL%").join(site);
  const post = await fetchPost(id);

  if (post) {
    const code = "KB-" + String(post.code || 0).padStart(4, "0");
    const title = post.title;
    const desc = (post.summary || String(post.content || "").replace(/\s+/g, " ").slice(0, 180) ||
      `${KIND[post.kind] || "Solusi"} · ${post.category}`).trim();
    const pageUrl = `${site}/post?id=${id}`;
    const og = `<!--OG-->
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(`${code} · ${KIND[post.kind] || "Solusi"} · ${post.category} — ${desc}`)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:image" content="${esc(site)}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(pageUrl)}">
<!--/OG-->`;
    html = html.replace(/<!--OG-->[\s\S]*?<!--\/OG-->/, og)
               .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} · ${esc(siteName)}</title>`);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  } else {
    res.setHeader("Cache-Control", "public, s-maxage=60");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.statusCode = 200;
  res.end(html);
};
