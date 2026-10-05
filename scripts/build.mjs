// Menyalin situs ke folder dist/ dan menulis dist/config.js dari environment variable.
// Dipakai oleh Vercel (Build Command) dan GitHub Actions.
// Hanya URL dan ANON key yang masuk ke browser. Jangan pernah memakai service_role / secret key di sini.
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const env = process.env;
const pick = (...names) => names.map((n) => env[n]).find((v) => v && v.trim())?.trim() || "";

const url = pick("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "VITE_SUPABASE_URL");
const anon = pick("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY", "SUPABASE_KEY", "SUPABASE_PUBLISHABLE_KEY");
const siteName = pick("SITE_NAME") || "Pusat Solusi IT";
const tagline = pick("SITE_TAGLINE") || "Link solusi & software untuk petugas lapangan";

function jwtRole(token) {
  try { return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).role; } catch { return null; }
}
if (anon.startsWith("sb_secret_") || jwtRole(anon) === "service_role") {
  console.error("✗ Key yang diberikan adalah SECRET/service_role key. Gunakan anon / publishable key.");
  process.exit(1);
}

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
// post.html sengaja TIDAK disalin: halaman /post disajikan oleh api/post.js
// (menyisipkan judul untuk pratinjau WhatsApp). Kalau disalin, file statis akan menang.
for (const f of ["index.html", "admin.html", "assets", "favicon.svg", "apple-touch-icon.png", "og-image.png"]) {
  cpSync(f, `dist/${f}`, { recursive: true });
}
const siteUrl = (pick("SITE_URL") || (env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + env.VERCEL_PROJECT_PRODUCTION_URL : "")).replace(/\/+$/, "");
for (const f of ["index.html", "admin.html"]) {
  writeFileSync(`dist/${f}`, readFileSync(`dist/${f}`, "utf8").split("%SITE_URL%").join(siteUrl));
}

if (url && anon) {
  writeFileSync("dist/config.js",
`window.APP_CONFIG = ${JSON.stringify({ SITE_NAME: siteName, SITE_TAGLINE: tagline, SUPABASE_URL: url, SUPABASE_ANON_KEY: anon }, null, 2)};\n`);
  console.log(`✓ config.js dibuat dari environment (${new URL(url).host})`);
} else {
  if (existsSync("config.js")) cpSync("config.js", "dist/config.js");
  console.warn("! SUPABASE_URL / SUPABASE_ANON_KEY tidak ditemukan; memakai config.js bawaan repo.");
}
console.log("✓ Build selesai di dist/");
